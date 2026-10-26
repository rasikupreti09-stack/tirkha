import { createServer } from "node:http";
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createPilotFixture } from "../tests/pilot-fixture.mjs";

export const MOCK_ANON_KEY = "tirkha-local-anon-key";
export async function startMockSupabase(port = 54321) {
  const fixture = await createPilotFixture();
  const { db } = fixture;
  const secret = randomUUID(), users = new Map(), sessions = new Map(), refreshTokens = new Map();
  const tables = new Map();
  const challenges = new Map();
  for (const row of (await db.query("select table_name,column_name from information_schema.columns where table_schema='public'")).rows) {
    if (!tables.has(row.table_name)) tables.set(row.table_name,new Set());
    tables.get(row.table_name).add(row.column_name);
  }
  const exposed = new Set(["profiles","professional_profiles","service_categories","bookings","booking_messages","booking_payments","professional_service_categories","hero_dispatch_notifications"]);
  const functions = {
    list_verified_professionals: ["p_category_slug","p_limit","p_offset"],
    create_booking_request: ["p_request_id","p_category_id","p_professional_id","p_service_address","p_job_details","p_scheduled_at","p_duration_minutes","p_latitude","p_longitude","p_resolved_address"],
    create_diagnostic_booking_request: ["p_request_id","p_category_id","p_professional_id","p_service_address","p_job_details","p_scheduled_at","p_duration_minutes","p_latitude","p_longitude","p_resolved_address","p_diagnostic_summary","p_diagnostic_severity","p_diagnostic_urgency","p_suggested_parts"],
    confirm_cod: ["p_booking_id"],
    get_booking_contact: ["p_booking_id"],
    transition_booking: ["p_booking_id","p_action"],
    update_hero_location: ["p_latitude","p_longitude","p_heading","p_speed_mps","p_battery_level","p_active_booking_id"],
    send_booking_message: ["p_booking_id","p_client_message_id","p_body"],
    register_push_device: ["p_token","p_installation_id"], unregister_push_device: ["p_installation_id"],
  };
  const fail = (message, status = 400, code = "local_mock_error") => Object.assign(new Error(message),{status,code});
  function publicUser(user) { const { hash, salt, ...data } = user; return data; }
  async function signup(input) {
    const email = String(input.email || "").trim().toLowerCase(), password = String(input.password || "");
    if (!email.includes("@") || password.length < 8) throw fail("Use a valid email and password of at least eight characters.");
    if (users.has(email)) throw fail("User already exists",422,"user_already_exists");
    const id = randomUUID(), salt = randomUUID();
    const metadata = {full_name: String(input.data?.full_name || "Local user"),requested_role: input.data?.requested_role === "professional" ? "professional" : "customer"};
    const user = { id,email,aud:"authenticated",role:"authenticated",app_metadata:{provider:"email",providers:["email"]},user_metadata:metadata,created_at:new Date().toISOString(),email_confirmed_at:new Date().toISOString(),salt,hash:scryptSync(password,salt,32) };
    await fixture.admin(); await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)",[id,metadata]); const row = (await db.query("select phone from public.profiles where id=$1",[id])).rows[0];
    user.phone=row.phone; user.phone_confirmed_at=new Date().toISOString();
    users.set(email,user); return user;
  }
  function issue(user) {
    const now = Math.floor(Date.now()/1000);
    const header = Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");
    const claims = Buffer.from(JSON.stringify({sub:user.id,aud:"authenticated",role:"authenticated",exp:now+3600,iat:now,jti:randomUUID()})).toString("base64url");
    const token = header+"."+claims+"."+createHmac("sha256",secret).update(header+"."+claims).digest("base64url");
    const refresh = randomUUID();sessions.set(token,{user,exp:now+3600,refresh});refreshTokens.set(refresh,user);
    return {access_token:token,refresh_token:refresh,token_type:"bearer",expires_in:3600,expires_at:now+3600,user:publicUser(user)};
  }
  const customer = await signup({email:"customer@tirkha.test",password:"TirkhaLocal123!",data:{full_name:"Pilot Customer",requested_role:"customer"}});
  const professional = await signup({email:"professional@tirkha.test",password:"TirkhaLocal123!",data:{full_name:"Pilot Professional",requested_role:"professional"}});
  await db.query("update public.professional_profiles set verification_status='verified',hourly_rate_paisa=12550 where profile_id=$1",[professional.id]);
  await db.query("insert into public.professional_service_categories select $1,id from public.service_categories",[professional.id]);
  let queue = Promise.resolve();
  const server = createServer((request,response) => {
    const send = (data,status=200) => { response.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});response.end(data===null?"":JSON.stringify(data)); };
    const origin = request.headers.origin;
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { send({message:"Local origins only"},403);return; }
    if(origin) response.setHeader("Access-Control-Allow-Origin",origin);
    response.setHeader("Access-Control-Allow-Headers","authorization,apikey,content-type,x-client-info,prefer,range,range-unit,x-supabase-api-version");
    response.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
    if(request.method==="OPTIONS") {send(null,204);return;}
    const task = async () => {
      try {
        const url = new URL(request.url,"http://127.0.0.1");
        if(url.pathname==="/health") {send({mode:"local-mock",database:"ephemeral",realtime:"polling"});return;}
        if(request.headers.apikey!==MOCK_ANON_KEY) throw fail("Invalid local anon key",401);
        let raw="";for await(const chunk of request) {raw+=chunk;if(raw.length>16000) throw fail("Request too large",413);}
        const input=raw?JSON.parse(raw):{};
        const access=request.headers.authorization?.replace(/^Bearer /i,"");
        const session=sessions.get(access);const user=session?.exp>Date.now()/1000?session.user:null;
        if(url.pathname==="/auth/v1/otp" && request.method==="POST") {
          const phone=String(input.phone || "");
          if(!/^\+9779[0-9]{9}$/.test(phone)) throw fail("Invalid Nepal mobile number");
          const previous=challenges.get(phone);
          if(previous && Date.now()-previous.sent<60000) throw fail("Wait before resending",429,"over_sms_send_rate_limit");
          const existing=[...users.values()].find(u=>u.phone===phone);
          if(!existing && input.create_user===false) throw fail("Phone is not registered",400,"invalid_credentials");
          challenges.set(phone,{sent:Date.now(),attempts:0,metadata:input.data || {}});
          send({message_id:randomUUID()}); return;
        }
        if(url.pathname==="/auth/v1/verify" && request.method==="POST") {
          const phone=String(input.phone || ""), challenge=challenges.get(phone);
          if(!challenge || Date.now()-challenge.sent>300000 || ++challenge.attempts>5 || input.token!=="123456" || input.type!=="sms") throw fail("Invalid or expired code",400,"otp_expired");
          let found=[...users.values()].find(u=>u.phone===phone);
          if(!found) {
            const id=randomUUID(), metadata={full_name:String(challenge.metadata.full_name || "Local user"),requested_role:challenge.metadata.requested_role==="professional"?"professional":"customer"};
            await fixture.admin();
            await db.query("insert into auth.users(id,raw_user_meta_data,phone,phone_confirmed_at) values($1,$2,$3,now())",[id,metadata,phone]);
            found={id,phone,aud:"authenticated",role:"authenticated",app_metadata:{provider:"phone",providers:["phone"]},user_metadata:metadata,created_at:new Date().toISOString(),phone_confirmed_at:new Date().toISOString()};
            users.set(phone,found);
          }
          challenges.delete(phone); send(issue(found));return;
        }
        if(url.pathname==="/auth/v1/signup" && request.method==="POST") {send(issue(await signup(input)));return;}
        if(url.pathname==="/auth/v1/token" && request.method==="POST") {
          let found;
          if(url.searchParams.get("grant_type")==="refresh_token") {found=refreshTokens.get(input.refresh_token);refreshTokens.delete(input.refresh_token);}
          else {found=users.get(String(input.email).toLowerCase());if(found && (!found.hash || !timingSafeEqual(scryptSync(String(input.password),found.salt,32),found.hash))) found=null;}
          if(!found) throw fail("Invalid credentials",400,"invalid_credentials");send(issue(found));return;
        }
        if(url.pathname==="/auth/v1/user") {if(!user) throw fail("Session expired",401);send(publicUser(user));return;}
        if(url.pathname==="/auth/v1/logout" && request.method==="POST") {if(session) refreshTokens.delete(session.refresh);sessions.delete(access);send(null,204);return;}
        await fixture.as(user?.id,user?"authenticated":"anon");
        let rows;
        if(url.pathname.startsWith("/rest/v1/rpc/") && request.method==="POST") {
          const name=url.pathname.split("/").at(-1), args=functions[name];
          if(!args) throw fail("RPC is not available in the local mock",404);
          const selected=args.filter(key=>key in input), values=selected.map(key=>input[key]);
          const invocation=`public.${name}(${selected.map((key,i)=>`${key} => $${i+1}`).join(",")})`;
          if(name==="update_hero_location") { await db.query(`select ${invocation}`,values); send(null); return; }
          rows=(await db.query(`select row_to_json(r) data from ${invocation} r`,values)).rows.map(r=>r.data);
        } else if(url.pathname.startsWith("/rest/v1/") && request.method==="GET") {
          const name=url.pathname.split("/").at(-1);if(!exposed.has(name)) throw fail("Table unavailable",404);
          const columns=tables.get(name), values=[], filters=[];
          const column=(name)=>{if(!columns.has(name)) throw fail("Invalid column");return '"'+name+'"';};
          for(const [key,value] of url.searchParams) {
            if(["select","order","limit","offset"].includes(key))continue;
            if(key==="or") {
              const match=/^\(created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([0-9a-f-]+)\)\)$/.exec(value);
              if(!match || match[1]!==match[2] || !columns.has("created_at"))throw fail("Unsupported local filter");
              values.push(match[1],match[3]);filters.push(`(created_at < $${values.length-1} or (created_at = $${values.length-1} and id < $${values.length}))`);continue;
            }
            const field=column(key);
            if(value==="is.null")filters.push(field+" is null");
            else if(value.startsWith("in.(") && value.endsWith(")")) {
              const set=value.slice(4,-1).split(",");filters.push(field+" in ("+set.map(item=>{values.push(item);return "$"+values.length;}).join(",")+")");
            } else {const match=/^(eq|gt|lt)\.(.*)$/.exec(value);if(!match)throw fail("Unsupported local filter");values.push(match[2]);filters.push(field+({eq:" = ",gt:" > ",lt:" < "}[match[1]])+"$"+values.length);}
          }
          const order=(url.searchParams.get("order")||(columns.has("id")?"id.asc":"profile_id.asc")).split(",").map(part=>{const [key,direction]=part.split(".");return column(key)+(direction==="desc"?" desc":" asc");}).join(",");
          const limit=Math.max(0,Math.min(1000,Number(url.searchParams.get("limit")||1000))), offset=Math.max(0,Number(url.searchParams.get("offset")||0));
          if(!Number.isInteger(limit)||!Number.isSafeInteger(offset))throw fail("Invalid pagination");
          rows=(await db.query(`select row_to_json(r) data from (select * from public.${name}${filters.length?" where "+filters.join(" and "):""} order by ${order} limit ${limit} offset ${offset}) r`,values)).rows.map(r=>r.data);
        } else throw fail("This feature is not implemented by the local mock",404);
        if(request.headers.accept?.includes("application/vnd.pgrst.object+json")) {if(rows.length!==1)throw fail("Expected one row",406,"PGRST116");send(rows[0]);} else send(rows);
      } catch(error) {send({message:error.message,code:error.code||"local_mock_error",error_code:error.code||"local_mock_error"},error.status||400);}
      finally {await fixture.admin();}
    };
    queue=queue.then(task,task);
  });
  try {await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});}
  catch(error){await db.close();throw error;}
  return { server,url:"http://127.0.0.1:"+server.address().port,customer:publicUser(customer),professional:publicUser(professional),async close(){await new Promise(resolve=>server.close(resolve));await queue;await db.close();} };
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const mock=await startMockSupabase(Number(process.env.TIRKHA_MOCK_PORT||54321));
  console.log(`Local mock ready at ${mock.url}; seeded customer@tirkha.test and professional@tirkha.test, password TirkhaLocal123!`);
  console.log("Ephemeral data. SMS code 123456; seeded phones +9779800000001 and +9779800000002. No real SMS, payments, push or email delivery.");
  for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>{void mock.close().then(()=>process.exit(0));});
}



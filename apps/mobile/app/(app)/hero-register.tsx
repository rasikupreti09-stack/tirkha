import { AccountGate } from "../../components/account-gate";
import { HeroRegistrationScreen } from "../../components/hero-registration-screen";

export default function HeroRegister() {
  return <AccountGate roles={["professional"]}>{account => <HeroRegistrationScreen account={account} />}</AccountGate>;
}

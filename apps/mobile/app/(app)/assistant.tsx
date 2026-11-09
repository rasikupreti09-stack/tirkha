import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

type Recommendation = {
  title: string;
  category: 'Plumbing' | 'Electrical';
  description: string;
};

type ChatMessage = {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  recommendation?: Recommendation;
};

const PROMPTS = [
  { label: 'Leaking Pipe', text: 'I have a leaking pipe' },
  { label: 'Electrical Outlet Spark', text: 'My electrical outlet is sparking' },
];

function diagnose(text: string): Recommendation | undefined {
  const normalized = text.toLocaleLowerCase();
  const plumbingTerms = ['leak', 'pipe', 'tap', 'faucet', 'water', 'नल', 'पानी', 'चुह'];
  const electricalTerms = ['spark', 'outlet', 'socket', 'electric', 'wire', 'short', 'बिजुली', 'करन्ट', 'तार'];

  if (plumbingTerms.some((term) => normalized.includes(term))) {
    return {
      title: 'Plumbing support',
      category: 'Plumbing',
      description: 'A plumber can inspect the leak and confirm the repair scope on site.',
    };
  }

  if (electricalTerms.some((term) => normalized.includes(term))) {
    return {
      title: 'Electrical safety support',
      category: 'Electrical',
      description: 'An electrician can inspect the outlet safely and identify the cause.',
    };
  }

  return undefined;
}

export default function AssistantScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Namaste! Tell me what is happening at home. I can help narrow down the service you may need.',
    },
  ]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = (value = inputText) => {
    const text = value.trim();
    if (!text) return;

    const recommendation = diagnose(text);
    const reply: ChatMessage = {
      id: `assistant-${Date.now()}`,
      sender: 'assistant',
      text: recommendation
        ? 'From what you described, this service may be a good place to start. A professional should confirm the issue and final scope on site.'
        : 'Could you share one more detail—what is affected, and when did the problem begin? You can also choose a suggestion below.',
      recommendation,
    };

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, sender: 'user', text },
      reply,
    ]);
    setInputText('');
  };

  const useSuggestion = (recommendation: Recommendation) => {
    setInputText(`${recommendation.category}: ${recommendation.title}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={{ color: "#087A5B", fontSize: 20 }}>•</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TIRKHA · HOME HELP</Text>
            <Text style={styles.headerTitle}>Tirkha AI Assistant</Text>
          </View>
          <View style={styles.assistantMark}>
            <Text style={{ color: "#087A5B", fontSize: 20 }}>•</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>QUICK SUGGESTIONS</Text>
          <View style={styles.promptRow}>
            {PROMPTS.map((prompt) => (
              <TouchableOpacity
                key={prompt.label}
                accessibilityRole="button"
                onPress={() => sendMessage(prompt.text)}
                style={styles.promptChip}
              >
                <Text style={styles.promptText}>{prompt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageGroup,
                message.sender === 'user' ? styles.userGroup : styles.assistantGroup,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  message.sender === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.sender === 'user' ? styles.userMessageText : styles.assistantMessageText,
                  ]}
                >
                  {message.text}
                </Text>
              </View>

              {message.recommendation && (
                <View style={styles.recommendationCard}>
                  <View style={styles.recommendationIcon}>
                    <Text style={{ color: "#087A5B", fontSize: 20 }}>•</Text>
                  </View>
                  <View style={styles.recommendationCopy}>
                    <Text style={styles.recommendationCategory}>{message.recommendation.category}</Text>
                    <Text style={styles.recommendationTitle}>{message.recommendation.title}</Text>
                    <Text style={styles.recommendationDescription}>
                      {message.recommendation.description}
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => useSuggestion(message.recommendation!)}
                      style={styles.recommendationAction}
                    >
                      <Text style={styles.recommendationActionText}>Use this suggestion</Text>
                      <Text style={{ color: "#087A5B", fontSize: 20 }}>•</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.composerWrap}>
          <TextInput
            accessibilityLabel="Describe your home issue"
            style={styles.input}
            placeholder="Describe your home issue..."
            placeholderTextColor="#7b8794"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => sendMessage()}
            disabled={!inputText.trim()}
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          >
            <Text style={{ color: "#087A5B", fontSize: 20 }}>•</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f9fb' },
  screen: { flex: 1 },
  header: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8e5',
  },
  backButton: { width: 38, height: 42, justifyContent: 'center' },
  headerCopy: { flex: 1, paddingLeft: 6 },
  eyebrow: { color: '#087f5b', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  headerTitle: { marginTop: 3, color: '#202b3b', fontSize: 18, fontWeight: '700' },
  assistantMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf5ef',
  },
  chat: { flex: 1 },
  chatContent: { padding: 18, paddingBottom: 26 },
  sectionLabel: { color: '#687782', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11, marginBottom: 22 },
  promptChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dce6df',
    backgroundColor: '#fff',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  promptText: { color: '#35483f', fontSize: 13, fontWeight: '600' },
  messageGroup: { maxWidth: '92%', marginBottom: 16 },
  assistantGroup: { alignSelf: 'flex-start' },
  userGroup: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12 },
  assistantBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e8e4',
    borderTopLeftRadius: 6,
  },
  userBubble: { backgroundColor: '#087f5b', borderTopRightRadius: 6 },
  messageText: { fontSize: 15, lineHeight: 22 },
  assistantMessageText: { color: '#263342' },
  userMessageText: { color: '#fff' },
  recommendationCard: {
    flexDirection: 'row',
    marginTop: 10,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce8df',
  },
  recommendationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eaf5ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationCopy: { flex: 1, paddingLeft: 11 },
  recommendationCategory: { color: '#087f5b', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  recommendationTitle: { marginTop: 3, color: '#202b3b', fontSize: 15, fontWeight: '700' },
  recommendationDescription: { marginTop: 5, color: '#64717d', fontSize: 13, lineHeight: 19 },
  recommendationAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  recommendationActionText: { color: '#087f5b', fontSize: 13, fontWeight: '700' },
  composerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8e5',
  },
  input: {
    flex: 1,
    maxHeight: 112,
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: '#f2f6f4',
    color: '#202b3b',
    fontSize: 15,
    lineHeight: 21,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#087f5b',
  },
  sendButtonDisabled: { backgroundColor: '#9fb5aa' },
});

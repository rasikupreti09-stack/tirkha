import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null; retryKey: number };

/** Keep a React render error from leaving the native app on a blank screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) console.error("Tirkha screen failed to render", error, info.componentStack);
  }

  retry = () => this.setState(current => ({ error: null, retryKey: current.retryKey + 1 }));

  render() {
    if (this.state.error) return <View style={{ flex: 1, justifyContent: "center", padding: 28, backgroundColor: "#F8FAFC" }}>
      <Text accessibilityRole="header" style={{ marginBottom: 10, color: "#1F2937", fontSize: 24, fontWeight: "700" }}>Tirkha needs to refresh</Text>
      <Text accessibilityRole="alert" style={{ marginBottom: 22, color: "#475569", fontSize: 16, lineHeight: 24 }}>A screen could not be opened. Your saved sign-in is safe. Try loading the app again.</Text>
      <Pressable accessibilityRole="button" onPress={this.retry} style={{ minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#1F2937", padding: 12 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Reload Tirkha</Text>
      </Pressable>
      {__DEV__ ? <Text style={{ marginTop: 18, color: "#64748B", fontSize: 12 }}>{this.state.error.message}</Text> : null}
    </View>;
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

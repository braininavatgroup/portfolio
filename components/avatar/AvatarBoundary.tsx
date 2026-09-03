"use client";

import { Component, type ReactNode } from "react";

export class AvatarBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Avatar renderer failed", error);
    }
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import { validateEmail, validatePassword, validateRequiredText } from "@/lib/validation";

type FormState = {
  loading: boolean;
  message: string;
  error: boolean;
};

const initialState: FormState = {
  loading: false,
  message: "",
  error: false,
};

export default function LoginPage() {
  const router = useRouter();
  const [signInState, setSignInState] = useState<FormState>(initialState);
  const [signUpState, setSignUpState] = useState<FormState>(initialState);

  const disabled = useMemo(() => signInState.loading || signUpState.loading, [signInState.loading, signUpState.loading]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!validateEmail(email) || !validatePassword(password)) {
      setSignInState({ loading: false, message: "メール形式またはパスワード（8文字以上）が不正です。", error: true });
      return;
    }

    setSignInState({ loading: true, message: "ログイン中...", error: false });

    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setSignInState({ loading: false, message: `ログイン失敗: ${error.message}`, error: true });
      return;
    }

    setSignInState({ loading: false, message: "ログイン成功。メインへ移動します。", error: false });
    router.push("/main");
    router.refresh();
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!validateRequiredText(displayName, 2, 40) || !validateEmail(email) || !validatePassword(password)) {
      setSignUpState({ loading: false, message: "ユーザー名2-40文字、正しいメール、8文字以上のパスワードが必要です。", error: true });
      return;
    }

    setSignUpState({ loading: true, message: "アカウント作成中...", error: false });

    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      setSignUpState({ loading: false, message: `新規登録失敗: ${error.message}`, error: true });
      return;
    }

    setSignUpState({ loading: false, message: "登録完了。メール確認後にログインしてください。", error: false });
  };

  return (
    <main className="split">
      <section className="panel">
        <h1>ログイン</h1>
        <p className="small">Supabase Auth（メール/パスワード）で認証します。</p>
        <form onSubmit={handleSignIn}>
          <label>
            メールアドレス
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            パスワード
            <input name="password" type="password" placeholder="8文字以上" required minLength={8} />
          </label>
          <button className="button" type="submit" disabled={disabled}>
            ログイン
          </button>
          {signInState.message ? <p className={signInState.error ? "small error-text" : "small success-text"}>{signInState.message}</p> : null}
        </form>
      </section>

      <section className="panel">
        <h2>アカウント作成</h2>
        <form onSubmit={handleSignUp}>
          <label>
            ユーザー名
            <input name="displayName" type="text" placeholder="ComixXユーザー" required minLength={2} maxLength={40} />
          </label>
          <label>
            メールアドレス
            <input name="email" type="email" placeholder="new@example.com" required />
          </label>
          <label>
            パスワード
            <input name="password" type="password" placeholder="8文字以上" required minLength={8} />
          </label>
          <button className="button secondary" type="submit" disabled={disabled}>
            新規登録
          </button>
          {signUpState.message ? <p className={signUpState.error ? "small error-text" : "small success-text"}>{signUpState.message}</p> : null}
        </form>
      </section>
    </main>
  );
}

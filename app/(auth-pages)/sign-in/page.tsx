"use client";

import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import { useState, use } from "react";

export default function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = use(props.searchParams);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(true);

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    // Call the signInAction with the form data
    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    try {
      await signInAction(formData);
    } catch (error) {
      console.error("Sign-in error:", error);
      // setError("Sign-in failed. Please check your credentials.");
    }
  };

  return (
    <div className="w-full py-8 bg-gradient-to-b from-secondary/20 to-background/95 min-h-screen flex justify-center items-center px-4 sm:px-6 lg:px-8">
      <form
        className="w-full max-w-md p-8 bg-background rounded-xl shadow-lg flex flex-col border border-border/30"
        onSubmit={handleSubmit}
      >
        <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Silahkan masukkan kredensial anda
        </p>
        <div className="flex flex-col gap-4 mt-8">
          <div>
            <Label htmlFor="email" className="text-foreground mb-1.5 block">
              Email
            </Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="bg-custom border-input focus:border-primary focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-foreground mb-1.5 block">
              Password
            </Label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Your password"
              error={error ? error : ""}
            />
          </div>

          <SubmitButton
            pendingText={"Signing In..."}
            className="mt-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-lg hover:opacity-90 transition-colors py-2.5 font-medium"
          >
            Sign in
          </SubmitButton>

          <FormMessage message={searchParams} />

          <div className="text-center mt-2 text-sm text-muted-foreground">
            Your account is not listed? Contact the administrator.
          </div>
        </div>
      </form>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full shadow-xl border border-border/30">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-amber-500 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <h3 className="text-lg font-semibold text-foreground">
                  Important Notice
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm font-medium text-amber-800">Penting:</p>
                <p className="text-sm text-amber-700 mt-1">
                  Ujian hanya dapat dikerjakan dengan{" "}
                  <b>1 sesi aktif saja per akun</b>. Untuk yang memiliki tim
                  dengan anggota lebih dari 1, tetap mengerjakan dengan{" "}
                  <b>akun masing-masing</b>, tidak menggunakan kredensial salah
                  satu anggota saja. <br />
                  <br />
                  Ujian bersifat <b>sharing antar akun dalam tim yang sama</b>.
                  Sehingga tidak perlu khawatir atas sinkronisasi data /
                  jawaban.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/50 transition-colors"
              >
                I understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

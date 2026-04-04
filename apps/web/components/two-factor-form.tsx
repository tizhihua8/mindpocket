"use client"

import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { twoFactor } from "@/lib/auth-client"
import { isPendingTwoFactorStateError } from "@/lib/auth-flow"
import { useT } from "@/lib/i18n"

type Mode = "totp" | "backup"

interface TwoFactorFormProps {
  nextPath: string
  onBackToLogin: () => void
}

export function TwoFactorForm({ nextPath, onBackToLogin }: TwoFactorFormProps) {
  const t = useT()
  const [mode, setMode] = useState<Mode>("totp")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setCode("")
  }

  const returnToCredentials = () => {
    setMode("totp")
    setCode("")
    onBackToLogin()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 备用码 InputOTP 存 10 位字符，API 需要 XXXXX-XXXXX 格式
    const submittedCode = mode === "totp" ? code : `${code.slice(0, 5)}-${code.slice(5)}`
    const result =
      mode === "totp"
        ? await twoFactor.verifyTotp({ code: submittedCode })
        : await twoFactor.verifyBackupCode({ code: submittedCode })

    setLoading(false)

    if (result.error) {
      if (isPendingTwoFactorStateError(result.error.message)) {
        // The pending 2FA cookie is gone, so the user must restart sign-in.
        toast.error(t.twoFactor.stateExpired)
        returnToCredentials()
        return
      }

      toast.error(mode === "totp" ? t.twoFactor.verifyFailed : t.twoFactor.backupCodeFailed)
      setCode("")
      return
    }

    toast.success(t.auth.loginSuccess)
    window.location.href = nextPath
  }

  const isTotp = mode === "totp"
  // 备用码 OTP 槽为 10 位（提交时补 "-"），TOTP 为 6 位
  const isSubmittable = isTotp ? code.length === 6 : code.length === 10

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-bold text-2xl">{t.twoFactor.loginTitle}</h1>
          <p className="text-balance text-muted-foreground text-sm">
            {isTotp ? t.twoFactor.loginDesc : t.twoFactor.useBackupCode}
          </p>
        </div>

        <Field>
          <div className="flex justify-center">
            {isTotp ? (
              <InputOTP autoFocus disabled={loading} maxLength={6} onChange={setCode} value={code}>
                <InputOTPGroup>
                  <InputOTPSlot className="h-12 w-12 text-lg" index={0} />
                  <InputOTPSlot className="h-12 w-12 text-lg" index={1} />
                  <InputOTPSlot className="h-12 w-12 text-lg" index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot className="h-12 w-12 text-lg" index={3} />
                  <InputOTPSlot className="h-12 w-12 text-lg" index={4} />
                  <InputOTPSlot className="h-12 w-12 text-lg" index={5} />
                </InputOTPGroup>
              </InputOTP>
            ) : (
              <InputOTP
                autoFocus
                disabled={loading}
                maxLength={10}
                onChange={setCode}
                pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                value={code}
              >
                <InputOTPGroup>
                  <InputOTPSlot className="h-12 w-9 text-base" index={0} />
                  <InputOTPSlot className="h-12 w-9 text-base" index={1} />
                  <InputOTPSlot className="h-12 w-9 text-base" index={2} />
                  <InputOTPSlot className="h-12 w-9 text-base" index={3} />
                  <InputOTPSlot className="h-12 w-9 text-base" index={4} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot className="h-12 w-9 text-base" index={5} />
                  <InputOTPSlot className="h-12 w-9 text-base" index={6} />
                  <InputOTPSlot className="h-12 w-9 text-base" index={7} />
                  <InputOTPSlot className="h-12 w-9 text-base" index={8} />
                  <InputOTPSlot className="h-12 w-9 text-base" index={9} />
                </InputOTPGroup>
              </InputOTP>
            )}
          </div>
        </Field>

        <Field>
          <div className="flex justify-center">
            <Button className="px-10" disabled={loading || !isSubmittable} type="submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.twoFactor.verify}
            </Button>
          </div>
        </Field>

        <div className="flex flex-col items-center gap-1.5 text-center">
          {isTotp ? (
            <button
              className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
              onClick={() => switchMode("backup")}
              type="button"
            >
              {t.twoFactor.cantUseAuthenticator}
            </button>
          ) : (
            <button
              className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
              onClick={() => switchMode("totp")}
              type="button"
            >
              {t.twoFactor.backToTotp}
            </button>
          )}
          <button
            className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
            onClick={returnToCredentials}
            type="button"
          >
            {t.twoFactor.backToLogin}
          </button>
        </div>
      </FieldGroup>
    </form>
  )
}

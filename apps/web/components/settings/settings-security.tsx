"use client"

import { Download } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { twoFactor } from "@/lib/auth-client"
import { useT } from "@/lib/i18n"
import { useUserStore } from "@/stores/user-store"

type EnableStep = "password" | "qr"

interface EnableData {
  totpURI: string
  backupCodes: string[]
}

// 将备用码列表下载为 JSON 文件
function exportBackupCodes(codes: string[]) {
  const blob = new Blob(
    [JSON.stringify({ backupCodes: codes, exportedAt: new Date().toISOString() }, null, 2)],
    { type: "application/json" }
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "mindpocket-2fa-backup-codes.json"
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsSecurity() {
  const t = useT()
  const { userInfo, fetchUser } = useUserStore()

  // 开启/关闭 Dialog 的显示状态
  const [enableOpen, setEnableOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  // 开启 Dialog 内的步骤和临时状态
  const [enableStep, setEnableStep] = useState<EnableStep>("password")
  const [enableData, setEnableData] = useState<EnableData | null>(null)
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  const isEnabled = userInfo.twoFactorEnabled ?? false

  // 关闭并重置开启 Dialog 的所有状态
  const closeEnableDialog = () => {
    setEnableOpen(false)
    setEnableStep("password")
    setEnableData(null)
    setPassword("")
    setCode("")
  }

  // 关闭并重置关闭 Dialog 的状态
  const closeDisableDialog = () => {
    setDisableOpen(false)
    setPassword("")
  }

  // Switch 切换：根据当前状态弹出对应 Dialog
  const handleToggle = (checked: boolean) => {
    if (checked) {
      setEnableOpen(true)
    } else {
      setDisableOpen(true)
    }
  }

  // 第一步：提交密码获取 TOTP URI 和备用码
  const handleEnablePassword = async () => {
    if (!password) {
      return
    }
    setLoading(true)
    const { data, error } = await twoFactor.enable({
      password,
      issuer: "MindPocket",
    })
    setLoading(false)
    if (error || !data) {
      toast.error(t.twoFactor.enableFailed)
      return
    }
    setEnableData({ totpURI: data.totpURI, backupCodes: data.backupCodes })
    setPassword("")
    setEnableStep("qr")
  }

  // 第二步：验证 TOTP 码完成绑定
  const handleVerifyAndEnable = async () => {
    if (code.length !== 6) {
      return
    }
    setLoading(true)
    const { error } = await twoFactor.verifyTotp({ code })
    setLoading(false)
    if (error) {
      toast.error(t.twoFactor.enableFailed)
      return
    }
    toast.success(t.twoFactor.enableSuccess)
    await fetchUser()
    closeEnableDialog()
  }

  // 关闭 2FA：密码确认
  const handleDisable = async () => {
    if (!password) {
      return
    }
    setLoading(true)
    const { error } = await twoFactor.disable({ password })
    setLoading(false)
    if (error) {
      toast.error(t.twoFactor.disableFailed)
      return
    }
    toast.success(t.twoFactor.disableSuccess)
    await fetchUser()
    closeDisableDialog()
  }

  return (
    <>
      {/* 设置项列表 */}
      <div className="space-y-1">
        {/* 2FA 设置项 */}
        <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-muted/50">
          <div className="space-y-0.5">
            <p className="font-medium text-sm">{t.twoFactor.title}</p>
            <p className="text-muted-foreground text-xs">{t.twoFactor.description}</p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {/* 开启 2FA Dialog */}
      <Dialog onOpenChange={(open) => !open && closeEnableDialog()} open={enableOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t.twoFactor.title}</DialogTitle>
            <DialogDescription>
              {enableStep === "password" ? t.twoFactor.enterPassword : t.twoFactor.scanQrDesc}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: 密码输入 */}
          {enableStep === "password" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="enable-password">{t.twoFactor.passwordLabel}</Label>
                <Input
                  autoFocus
                  disabled={loading}
                  id="enable-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEnablePassword()}
                  placeholder={t.twoFactor.passwordPlaceholder}
                  type="password"
                  value={password}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button disabled={loading} onClick={closeEnableDialog} variant="outline">
                  {t.twoFactor.cancel}
                </Button>
                <Button disabled={loading || !password} onClick={handleEnablePassword}>
                  {t.twoFactor.enable}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: 二维码 + 备用码 + 验证码 */}
          {enableStep === "qr" && enableData && (
            <div className="space-y-5">
              {/* QR 码 */}
              <div className="space-y-2">
                <p className="font-medium text-sm">{t.twoFactor.scanQr}</p>
                <div className="flex justify-center rounded-lg border bg-white p-4">
                  <QRCodeSVG size={150} value={enableData.totpURI} />
                </div>
              </div>

              {/* 备用码 + 导出按钮 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{t.twoFactor.backupCodes}</p>
                  <Button
                    onClick={() => exportBackupCodes(enableData.backupCodes)}
                    size="sm"
                    variant="outline"
                  >
                    <Download className="mr-1.5 size-3.5" />
                    {t.twoFactor.exportBackupCodes}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">{t.twoFactor.backupCodesDesc}</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/30 p-3">
                  {enableData.backupCodes.map((c) => (
                    <code className="font-mono text-xs" key={c}>
                      {c}
                    </code>
                  ))}
                </div>
              </div>

              {/* 验证码输入 */}
              <div className="space-y-2">
                <Label>{t.twoFactor.enterCode}</Label>
                <div className="flex justify-center">
                  <InputOTP
                    autoFocus
                    disabled={loading}
                    maxLength={6}
                    onChange={setCode}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyAndEnable()}
                    value={code}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button disabled={loading} onClick={closeEnableDialog} variant="outline">
                  {t.twoFactor.cancel}
                </Button>
                <Button disabled={loading || code.length !== 6} onClick={handleVerifyAndEnable}>
                  {t.twoFactor.verifyAndEnable}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 关闭 2FA Dialog */}
      <Dialog onOpenChange={(open) => !open && closeDisableDialog()} open={disableOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t.twoFactor.disable}</DialogTitle>
            <DialogDescription>{t.twoFactor.enterPassword}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">{t.twoFactor.passwordLabel}</Label>
              <Input
                autoFocus
                disabled={loading}
                id="disable-password"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDisable()}
                placeholder={t.twoFactor.passwordPlaceholder}
                type="password"
                value={password}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button disabled={loading} onClick={closeDisableDialog} variant="outline">
                {t.twoFactor.cancel}
              </Button>
              <Button disabled={loading || !password} onClick={handleDisable} variant="destructive">
                {t.twoFactor.disable}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

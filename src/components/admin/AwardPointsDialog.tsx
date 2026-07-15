import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  onSave: (amount: number, reason: string) => void | Promise<void>;
}

export default function AwardPointsDialog({ open, onOpenChange, studentName, onSave }: Props) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) { setAmount(0); setReason(""); }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{studentName}에게 포인트 부여</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>포인트</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label>사유</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" placeholder="예: 수업 참여 우수" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => onSave(amount, reason)} disabled={amount === 0}>부여</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

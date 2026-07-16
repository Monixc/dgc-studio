import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAllStudents } from "@/hooks/useClassStudents";
import {
  useShopItems, useCreateShopItem, useUpdateShopItem, useDeleteShopItem,
  useShopOrders, useDecideShopOrder,
} from "@/hooks/useShop";
import { uploadShopImage } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ShopItem } from "@/integrations/supabase/types";

const emptyForm = { name: "", image_url: "", cost: 0, stock: 0 };

export default function ShopManager() {
  const { user } = useAuth();
  const teacherId = user!.id;
  const { data: items = [], isLoading } = useShopItems();
  const { data: students = [] } = useAllStudents();
  const { data: orders = [] } = useShopOrders();
  const createMut = useCreateShopItem();
  const updateMut = useUpdateShopItem();
  const deleteMut = useDeleteShopItem();
  const decideMut = useDecideShopOrder();

  const [editing, setEditing] = useState<ShopItem | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const studentName = (id: string) => students.find((s) => s.id === id)?.display_name || "(이름 없음)";
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "(삭제된 상품)";
  const pendingOrders = orders.filter((o) => o.status === "pending");

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(item: ShopItem) {
    setEditing(item);
    setForm({ name: item.name, image_url: item.image_url, cost: item.cost, stock: item.stock });
    setOpen(true);
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadShopImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e: any) {
      toast.error(e?.message ?? "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, fields: form });
      } else {
        await createMut.mutateAsync({ teacherId, ...form });
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    }
  }

  async function remove(id: string) {
    if (!confirm("이 상품을 삭제할까요?")) return;
    try {
      await deleteMut.mutateAsync(id);
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function decide(orderId: string, status: "approved" | "rejected") {
    try {
      await decideMut.mutateAsync({ orderId, teacherId, status });
    } catch (e: any) {
      toast.error(e?.message ?? "처리 실패");
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">포인트 상점</h1>
        <Button onClick={openCreate}>
          <Plus /> 상품 등록
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 상품이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="mt-2 truncate text-sm font-medium">{item.name}</div>
              <div className="text-xs text-muted-foreground">{item.cost}P · 재고 {item.stock}</div>
              <div className="mt-2 flex gap-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(item)}>
                  <Pencil className="size-3.5" /> 수정
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(item.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 mt-8 text-lg font-semibold">구매 요청</h2>
      {pendingOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground">대기 중인 구매 요청이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {pendingOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
              <span>
                <span className="font-medium">{studentName(o.student_id)}</span> · {itemName(o.item_id)}
              </span>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => decide(o.id, "approved")}>
                  <Check className="size-3.5" /> 수락
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(o.id, "rejected")}>
                  <X className="size-3.5" /> 거절
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "상품 수정" : "상품 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>이름</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <Label>이미지</Label>
              {form.image_url && (
                <img src={form.image_url} alt="" className="mt-1 h-20 w-20 rounded object-cover" />
              )}
              <Input
                type="file"
                accept="image/*"
                className="mt-1"
                disabled={uploading}
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
              {uploading && <p className="mt-1 text-xs text-muted-foreground">업로드 중…</p>}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>포인트</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={form.cost || ""}
                  onChange={(e) => setForm({ ...form, cost: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex-1">
                <Label>수량</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={form.stock || ""}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={save} disabled={!form.name.trim() || uploading}>{editing ? "저장" : "등록"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { toast } from "sonner";
import { Coins, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePointsRanking } from "@/hooks/usePoints";
import { useShopItems, useMyShopOrders, useRequestPurchase } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { pending: "대기중", approved: "구매완료", rejected: "거절됨" } as const;

export default function ShopPanel() {
  const { user } = useAuth();
  const studentId = user!.id;
  const { data: items = [], isLoading } = useShopItems();
  const { data: ranking = [] } = usePointsRanking();
  const { data: myOrders = [] } = useMyShopOrders(studentId);
  const requestMut = useRequestPurchase();

  const balance = ranking.find((r) => r.studentId === studentId)?.total ?? 0;
  const hasPendingFor = (itemId: string) => myOrders.some((o) => o.item_id === itemId && o.status === "pending");
  const itemOf = (itemId: string) => items.find((i) => i.id === itemId);

  async function request(itemId: string) {
    try {
      await requestMut.mutateAsync({ studentId, itemId });
      toast.success("구매 요청을 보냈습니다. 선생님 승인을 기다려주세요.");
    } catch (e: any) {
      toast.error(e?.message ?? "요청 실패");
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">포인트 상점</h1>
        <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm font-medium shadow-sm">
          <Coins className="size-4 text-primary" />
          <span>{balance}P</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 상품이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => {
            const pending = hasPendingFor(item.id);
            const soldOut = item.stock < 1;
            const notEnough = balance < item.cost;
            return (
              <div key={item.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="mt-2 truncate text-sm font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.cost}P · 재고 {item.stock}</div>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  disabled={pending || soldOut || notEnough || requestMut.isPending}
                  onClick={() => request(item.id)}
                >
                  <ShoppingCart className="size-3.5" />
                  {pending ? "요청 중" : soldOut ? "품절" : notEnough ? "포인트 부족" : "구매 요청"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-2 mt-8 text-lg font-semibold">구매 내역</h2>
      {myOrders.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          아직 구매한 물품이 없습니다. 분발하세요.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {myOrders.map((o) => {
            const item = itemOf(o.item_id);
            return (
              <div key={o.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
                  {item?.image_url && (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="mt-2 truncate text-sm font-medium">{item?.name ?? "(삭제된 상품)"}</div>
                <div
                  className={cn(
                    "text-xs",
                    o.status === "approved" && "text-emerald-600",
                    o.status === "rejected" && "text-destructive",
                    o.status === "pending" && "text-muted-foreground",
                  )}
                >
                  {STATUS_LABEL[o.status]}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

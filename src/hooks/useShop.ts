import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SHOP_ITEMS_KEY, SHOP_ORDERS_KEY,
  listShopItems, createShopItem, updateShopItem, deleteShopItem,
  listShopOrders, listMyShopOrders, requestPurchase, decideShopOrder,
} from "@/lib/shop";
import { POINTS_KEY } from "@/lib/points";
import { notifyPush } from "@/lib/push";

export function useShopItems() {
  return useQuery({ queryKey: SHOP_ITEMS_KEY, queryFn: listShopItems });
}

export function useCreateShopItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherId, ...fields }: { teacherId: string; name: string; image_url: string; cost: number; stock: number }) =>
      createShopItem(teacherId, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: SHOP_ITEMS_KEY }),
  });
}

export function useUpdateShopItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; fields: Partial<{ name: string; image_url: string; cost: number; stock: number }> }) =>
      updateShopItem(args.id, args.fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: SHOP_ITEMS_KEY }),
  });
}

export function useDeleteShopItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShopItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: SHOP_ITEMS_KEY }),
  });
}

export function useShopOrders() {
  return useQuery({ queryKey: SHOP_ORDERS_KEY, queryFn: listShopOrders });
}

export function useMyShopOrders(studentId: string | undefined) {
  return useQuery({
    queryKey: [...SHOP_ORDERS_KEY, studentId],
    queryFn: () => listMyShopOrders(studentId!),
    enabled: !!studentId,
  });
}

export function useRequestPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { studentId: string; itemId: string }) => requestPurchase(args.studentId, args.itemId),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: SHOP_ORDERS_KEY });
      void notifyPush("shop_order_request", row.id);
    },
  });
}

export function useDecideShopOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { orderId: string; teacherId: string; status: "approved" | "rejected" }) =>
      decideShopOrder(args.orderId, args.teacherId, args.status),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: SHOP_ORDERS_KEY });
      qc.invalidateQueries({ queryKey: SHOP_ITEMS_KEY });
      qc.invalidateQueries({ queryKey: POINTS_KEY });
      void notifyPush("shop_order_decided", orderId);
    },
  });
}

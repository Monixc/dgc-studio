import { supabase } from "@/integrations/supabase/client";
import type { ShopItem, ShopOrder } from "@/integrations/supabase/types";

export const SHOP_ITEMS_KEY = ["shop-items"] as const;
export const SHOP_ORDERS_KEY = ["shop-orders"] as const;

export async function uploadShopImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("shop-items").upload(path, file);
  if (error) throw error;
  return supabase.storage.from("shop-items").getPublicUrl(path).data.publicUrl;
}

export async function listShopItems(): Promise<ShopItem[]> {
  const { data, error } = await supabase.from("shop_items").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShopItem[];
}

export async function createShopItem(
  teacherId: string,
  fields: { name: string; image_url: string; cost: number; stock: number },
): Promise<ShopItem> {
  const { data, error } = await supabase
    .from("shop_items")
    .insert({ created_by: teacherId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data as ShopItem;
}

export async function updateShopItem(
  id: string,
  fields: Partial<{ name: string; image_url: string; cost: number; stock: number }>,
): Promise<void> {
  const { error } = await supabase.from("shop_items").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteShopItem(id: string): Promise<void> {
  const { error } = await supabase.from("shop_items").delete().eq("id", id);
  if (error) throw error;
}

/** 선생님용: 전체 구매 요청(대기/처리 모두) */
export async function listShopOrders(): Promise<ShopOrder[]> {
  const { data, error } = await supabase.from("shop_orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShopOrder[];
}

/** 학생용: 본인 구매 요청 */
export async function listMyShopOrders(studentId: string): Promise<ShopOrder[]> {
  const { data, error } = await supabase
    .from("shop_orders")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShopOrder[];
}

export async function requestPurchase(studentId: string, itemId: string): Promise<ShopOrder> {
  const { data, error } = await supabase
    .from("shop_orders")
    .insert({ student_id: studentId, item_id: itemId })
    .select()
    .single();
  if (error) throw error;
  return data as ShopOrder;
}

export async function decideShopOrder(
  orderId: string,
  teacherId: string,
  status: "approved" | "rejected",
): Promise<void> {
  const { error } = await supabase
    .from("shop_orders")
    .update({ status, decided_by: teacherId, decided_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;
}

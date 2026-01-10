export type Product = {
  id: string;
  slug: string;
  qty: number;
  cost: number;
  price: number;
  mrp: number;
  tags: string[];
  is_weight: boolean;
  created_at: string;
  updated_at: string;
};
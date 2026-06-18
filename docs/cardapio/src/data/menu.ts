export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
};

export const categories = [
  { id: "entradas", name: "Entradas" },
  { id: "pratos", name: "Pratos" },
  { id: "bebidas", name: "Bebidas" },
  { id: "sobremesas", name: "Sobremesas" },
];

const img = (q: string) =>
  `https://images.unsplash.com/${q}?auto=format&fit=crop&w=600&q=70`;

export const products: Product[] = [
  // Entradas
  { id: "e1", name: "Bolinho de Bacalhau", description: "6 unidades crocantes com limão siciliano", price: 32, category: "entradas", image: img("photo-1625938145312-c board?") },
  { id: "e2", name: "Batata Rústica", description: "Com alecrim, parmesão e maionese da casa", price: 28, category: "entradas", image: img("photo-1573080496219-bb080dd4f877") },
  { id: "e3", name: "Tábua de Frios", description: "Queijos, embutidos, azeitonas e torradas", price: 58, category: "entradas", image: img("photo-1452195100486-9cc805987862") },

  // Pratos
  { id: "p1", name: "Hambúrguer Artesanal", description: "200g, cheddar, bacon, brioche e fritas", price: 42, category: "pratos", image: img("photo-1568901346375-23c9450c58cd") },
  { id: "p2", name: "Risoto de Funghi", description: "Arroz arbóreo, mix de cogumelos e parmesão", price: 56, category: "pratos", image: img("photo-1476124369491-e7addf5db371") },
  { id: "p3", name: "Picanha na Chapa", description: "300g acompanha arroz, farofa e vinagrete", price: 78, category: "pratos", image: img("photo-1558030006-450675393462") },
  { id: "p4", name: "Salmão Grelhado", description: "Filé com legumes salteados e purê de batata", price: 72, category: "pratos", image: img("photo-1467003909585-2f8a72700288") },

  // Bebidas
  { id: "b1", name: "Chopp Pilsen 300ml", description: "Geladinho, cremoso, direto da torneira", price: 12, category: "bebidas", image: img("photo-1535958636474-b021ee887b13") },
  { id: "b2", name: "Caipirinha", description: "Cachaça artesanal, limão e açúcar", price: 18, category: "bebidas", image: img("photo-1551024709-8f23befc6f87") },
  { id: "b3", name: "Coca-Cola 350ml", description: "Lata gelada", price: 7, category: "bebidas", image: img("photo-1561758033-d89a9ad46330") },
  { id: "b4", name: "Suco de Laranja 400ml", description: "Natural, sem açúcar", price: 12, category: "bebidas", image: img("photo-1600271886742-f049cd451bba") },

  // Sobremesas
  { id: "s1", name: "Petit Gateau", description: "Bolo quente de chocolate com sorvete de creme", price: 26, category: "sobremesas", image: img("photo-1606313564200-e75d5e30476c") },
  { id: "s2", name: "Cheesecake de Frutas Vermelhas", description: "Fatia generosa com calda artesanal", price: 22, category: "sobremesas", image: img("photo-1567171466295-4afa63d45416") },
];

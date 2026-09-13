import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Product {
  id: number;
  nome: string;
  stock: number;
  precio: number;
  categoria: string;
}

interface StockItem {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface Invoice {
  id: string;
  client_id: string;
  amount: number;
  date: string;
}

// In-memory data store migrated from celtia_enterprise.db and data/inventory.json
const inventoryData: Product[] = [
  { id: 1, nome: 'Procesador Ryzen 7', stock: 15, precio: 299.99, categoria: 'Hardware' },
  { id: 2, nome: 'Memoria RAM 16GB', stock: 40, precio: 85.50, categoria: 'Memorias' },
  { id: 3, nome: 'Disco SSD 1TB', stock: 25, precio: 110.00, categoria: 'Almacenamento' },
  { id: 4, nome: 'Placa Base X570', stock: 8, precio: 210.00, categoria: 'Hardware' },
];

const stockData: StockItem[] = [
  { id: 1, product_name: 'Intel Core i9', quantity: 10, price: 550.0 },
  { id: 2, product_name: 'AMD Ryzen 9', quantity: 15, price: 490.0 },
  { id: 3, product_name: 'NVIDIA RTX 4080', quantity: 5, price: 1200.0 },
];

const invoicesData: Invoice[] = [];

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '2.0.0', system: 'CELTIA Enterprise OS' });
  });

  app.get('/api/inventory', (req, res) => {
    res.json({ productos: inventoryData });
  });

  app.post('/api/inventory/add', (req, res) => {
    const { nome, stock, precio, categoria } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'O nome é obrigatorio' });
    }
    const newProduct: Product = {
      id: inventoryData.length + 1,
      nome: String(nome),
      stock: Number(stock) || 0,
      precio: Number(precio) || 0,
      categoria: categoria ? String(categoria) : 'Xeral',
    };
    inventoryData.push(newProduct);
    res.json({ status: 'success', product: newProduct });
  });

  app.get('/api/stock', (req, res) => {
    res.json(stockData);
  });

  app.post('/api/invoices', (req, res) => {
    const { client_id = 'C-001', amount = 100 } = req.body;
    const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
    const invoiceId = `INV-${hex}`;
    const newInvoice: Invoice = {
      id: invoiceId,
      client_id: String(client_id),
      amount: Number(amount) || 0,
      date: new Date().toISOString(),
    };
    invoicesData.push(newInvoice);
    res.json({
      status: 'success',
      invoice_id: invoiceId,
      total: newInvoice.amount,
      message: `Factura ${invoiceId} gardada na base de datos.`,
    });
  });

  // Orchestrator Chat Endpoint
  app.post('/api/chat', async (req, res) => {
    const message = (req.body?.message || '').trim();
    const userId = req.body?.user_id || 'admin';

    if (!message) {
      return res.json({ response: 'CELTIA v2 Online. Introduza unha orde.' });
    }

    const lower = message.toLowerCase();

    // Try Gemini if API key is provided
    const ai = getGeminiClient();
    if (ai) {
      try {
        const stockSummary = stockData.map(s => `${s.product_name}: ${s.quantity}`).join(', ');
        const inventorySummary = inventoryData.map(i => `${i.nome}: ${i.stock} (prezo: ${i.precio}€)`).join(', ');
        const prompt = `Ti es o Axente Orquestrador de CELTIA Enterprise OS v2.
Datos de stock actual: ${stockSummary}.
Datos de inventario actual: ${inventorySummary}.
Número de facturas emitidas: ${invoicesData.length}.
Instrucións:
- Responde en galego ou español de xeito conciso, profesional e estilo consola industrial.
- Se o usuario pide facturas ou cobrar, xera unha confirmación de factura.
- Se o usuario pregunta por stock ou produtos específicos (como Intel, AMD, etc.), indica as cantidades dispoñibles con precisión.
- Mensaxe do usuario: "${message}"`;

        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        if (result.text) {
          return res.json({ response: result.text.trim() });
        }
      } catch (err) {
        console.warn('Gemini invocation error, falling back to rule orchestrator:', err);
      }
    }

    // Deterministic Rule-Based Orchestrator (matches original Python orchestrator & agents)
    // 1. Stock Agent logic
    if (
      lower.includes('stock') ||
      lower.includes('existencias') ||
      lower.includes('inventario') ||
      lower.includes('intel') ||
      lower.includes('ryzen') ||
      lower.includes('almacen') ||
      lower.includes('almacén')
    ) {
      if (lower.includes('intel')) {
        const intel = stockData.find(s => s.product_name.toLowerCase().includes('intel'));
        const qty = intel ? intel.quantity : 0;
        return res.json({
          response: qty > 0 ? `Temos ${qty} unidades de Intel en stock.` : 'Non hai stock de Intel.',
        });
      }
      const allStock = [
        ...stockData.map(s => `${s.product_name}: ${s.quantity}`),
        ...inventoryData.map(i => `${i.nome}: ${i.stock}`),
      ];
      return res.json({
        response: `Inventario actual: ${allStock.join(', ')}`,
      });
    }

    // 2. Invoice Agent logic
    if (
      lower.includes('factura') ||
      lower.includes('facturar') ||
      lower.includes('cobrar') ||
      lower.includes('invoice')
    ) {
      const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
      const invoiceId = `INV-${hex}`;
      const amount = 100.0;
      invoicesData.push({
        id: invoiceId,
        client_id: userId,
        amount,
        date: new Date().toISOString(),
      });
      return res.json({
        response: `Factura: ${invoiceId} - Total: ${amount}€ xerada e rexistrada con éxito.`,
      });
    }

    // 3. Greetings & status
    if (
      lower.includes('ola') ||
      lower.includes('hola') ||
      lower.includes('bos dias') ||
      lower.includes('bos días') ||
      lower.includes('boas') ||
      lower.includes('status') ||
      lower.includes('estado')
    ) {
      return res.json({
        response: 'CELTIA v2 Online. Todos os módulos activos (Stock, Finanzas, Comms). Agardando ordes.',
      });
    }

    if (lower.includes('axuda') || lower.includes('help')) {
      return res.json({
        response: 'Comandos dispoñibles: "stock" (ver inventario), "stock intel" (comprobar Intel), "factura" (emitir factura), "estado" (verificar núcleo).',
      });
    }

    // Default response
    return res.json({
      response: `Orde procesada polo núcleo CELTIA: "${message}". Estado: Executado correctamente.`,
    });
  });

  // Vite middleware in dev; static dist files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CELTIA Enterprise OS running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

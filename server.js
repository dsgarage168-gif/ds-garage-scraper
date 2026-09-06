const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json());

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const ML_AFFILIATE_URL =
  "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function resposta(res, dados, status = 200) {
  return res.status(status).json(dados);
}

function limparItemId(itemId) {
  return String(itemId || "").trim();
}

function gerarTag() {
  const agora = new Date();

  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(agora.getUTCDate()).padStart(2, "0");
  const hora = String(agora.getUTCHours()).padStart(2, "0");
  const minuto = String(agora.getUTCMinutes()).padStart(2, "0");
  const segundo = String(agora.getUTCSeconds()).padStart(2, "0");

  return `dx${ano}${mes}${dia}${hora}${minuto}${segundo}`;
}

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
  resposta(res, {
    status: "online",
    projeto: "DS Garage Scraper",
    versao: "2.0",
    mensagem: "Servidor funcionando!",
    endpoints: [
      "/",
      "/buscar",
      "/teste-afiliado",
      "/status-afiliado"
    ]
  });
});

/* =========================================================
   SCRAPER ANTIGO
========================================================= */

app.get("/buscar", async (req, res) => {
  const keyword = req.query.keyword || "automotivo";

  const url =
    `https://lista.mercadolivre.com.br/${encodeURIComponent(keyword)}`;

  try {
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        "Accept-Language":
          "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    const $ = cheerio.load(response.data);

    const produtos = [];

    $(".ui-search-result__wrapper").each((index, element) => {
      if (produtos.length >= 10) return;

      const titulo = $(element)
        .find(".poly-component__title")
        .first()
        .text()
        .trim();

      const preco = $(element)
        .find(".andes-money-amount__fraction")
        .first()
        .text()
        .trim();

      const link = $(element)
        .find("a")
        .first()
        .attr("href");

      const imagem =
        $(element).find("img").first().attr("src") ||
        $(element).find("img").first().attr("data-src");

      if (titulo) {
        produtos.push({
          titulo,
          preco: preco || null,
          link: link || null,
          imagem: imagem || null
        });
      }
    });

    return resposta(res, {
      sucesso: true,
      keyword,
      status_http: response.status,
      url_final:
        response.request?.res?.responseUrl || url,
      quantidade: produtos.length,
      produtos
    });

  } catch (error) {
    return resposta(res, {
      sucesso: false,
      keyword,
      erro: error.message,
      status_http: error.response?.status || null,
      url_final:
        error.response?.request?.res?.responseUrl || null,
      resposta: error.response?.data
        ? String(error.response.data).substring(0, 1000)
        : null
    }, 500);
  }
});

/* =========================================================
   STATUS DA CONFIGURAÇÃO DE AFILIADO
========================================================= */

app.get("/status-afiliado", (req, res) => {

  const cookie =
    process.env.ML_AFFILIATE_COOKIE || "";

  const csrf =
    process.env.ML_AFFILIATE_CSRF || "";

  return resposta(res, {
    sucesso: true,

    servidor: "online",

    configuracao: {
      cookie_configurado:
        cookie.trim().length > 0,

      csrf_configurado:
        csrf.trim().length > 0
    },

    observacao:
      "Os valores das credenciais nunca são exibidos."
  });
});

/* =========================================================
   TESTE DO CREATE LINK
========================================================= */

app.get("/teste-afiliado", async (req, res) => {

  const itemId =
    limparItemId(req.query.item_id);

  if (!itemId) {
    return resposta(res, {
      sucesso: false,
      erro: "Informe ?item_id=MLB..."
    }, 400);
  }

  const cookie =
    process.env.ML_AFFILIATE_COOKIE || "";

  const csrf =
    process.env.ML_AFFILIATE_CSRF || "";

  if (!cookie || !csrf) {
    return resposta(res, {
      sucesso: false,
      etapa: "configuracao",
      erro:
        "Credenciais de afiliado ainda não configuradas no Render.",
      cookie_configurado:
        cookie.trim().length > 0,
      csrf_configurado:
        csrf.trim().length > 0
    }, 400);
  }

  const tag = gerarTag();

  const originUrl =
    `https://www.mercadolivre.com.br/MLB-${itemId.replace(/^MLB-?/i, "")}`;

  const payload = {
    itemId,
    itemAddToList: itemId,
    tag,
    type: "product",
    buyBoxWinner: itemId,
    extraCommission: "true",
    urls: [
      originUrl
    ]
  };

  try {

    const response = await axios.post(
      ML_AFFILIATE_URL,
      payload,
      {
        timeout: 20000,

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Content-Type":
            "application/json",

          "Origin":
            "https://www.mercadolivre.com.br",

          "Referer":
            "https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true",

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",

          "x-csrf-token":
            csrf,

          "Cookie":
            cookie
        }
      }
    );

    return resposta(res, {
      sucesso: true,
      http_status: response.status,
      item_id: itemId,
      tag,
      resposta: response.data
    });

  } catch (error) {

    return resposta(res, {
      sucesso: false,
      http_status:
        error.response?.status || null,

      item_id: itemId,

      tag,

      erro: error.message,

      resposta:
        error.response?.data || null
    }, error.response?.status || 500);
  }
});

/* =========================================================
   START
========================================================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `DS Garage Scraper rodando na porta ${PORT}`
  );
});

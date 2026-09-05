const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.json({
    status: "online",
    projeto: "DS Garage Scraper",
    mensagem: "Servidor funcionando!"
  });
});

app.get("/buscar", async (req, res) => {
  const keyword = req.query.keyword || "automotivo";

  const url = `https://lista.mercadolivre.com.br/${encodeURIComponent(
    keyword
  )}`;

  try {
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
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

    res.json({
      sucesso: true,
      keyword,
      status_http: response.status,
      url_final: response.request?.res?.responseUrl || url,
      quantidade: produtos.length,
      produtos
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      keyword,
      erro: error.message,
      status_http: error.response?.status || null,
      url_final: error.response?.request?.res?.responseUrl || null,
      resposta: error.response?.data
        ? String(error.response.data).substring(0, 1000)
        : null
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DS Garage Scraper rodando na porta ${PORT}`);
});

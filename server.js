const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json());

const ML_BASE_URL =
  "https://www.mercadolivre.com.br";

const ML_AFFILIATE_URL =
  "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

/* =========================================================
   AUXILIARES
========================================================= */

function resposta(res, dados, status = 200) {
  return res.status(status).json(dados);
}

function limparItemId(itemId) {
  return String(itemId || "").trim();
}

function credenciaisConfiguradas() {
  const cookie =
    process.env.ML_AFFILIATE_COOKIE || "";

  const csrf =
    process.env.ML_AFFILIATE_CSRF || "";

  const tag =
    process.env.ML_AFFILIATE_TAG || "";

  return {
    cookie: cookie.trim(),
    csrf: csrf.trim(),
    tag: tag.trim(),

    cookieConfigurado:
      cookie.trim().length > 0,

    csrfConfigurado:
      csrf.trim().length > 0,

    tagConfigurada:
      tag.trim().length > 0
  };
}

/* =========================================================
   HEADERS
========================================================= */

function headersSessao() {
  const credenciais =
    credenciaisConfiguradas();

  return {
    Accept:
      "application/json, text/plain, */*",

    "Accept-Language":
      "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",

    "Content-Type":
      "application/json",

    Origin:
      "https://www.mercadolivre.com.br",

    Referer:
      "https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true",

    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",

    "x-csrf-token":
      credenciais.csrf,

    Cookie:
      credenciais.cookie
  };
}

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {

  return resposta(res, {

    status:
      "online",

    projeto:
      "DS Garage Scraper",

    versao:
      "2.5",

    mensagem:
      "Servidor funcionando!",

    endpoints: [
      "/",
      "/buscar",
      "/status-afiliado",
      "/validar-afiliado",
      "/teste-afiliado"
    ]
  });
});

/* =========================================================
   SCRAPER ANTIGO
========================================================= */

app.get("/buscar", async (req, res) => {

  const keyword =
    req.query.keyword ||
    "automotivo";

  const url =
    `https://lista.mercadolivre.com.br/${encodeURIComponent(keyword)}`;

  try {

    const response =
      await axios.get(
        url,
        {
          timeout: 20000,
          maxRedirects: 5,

          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",

            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

            "Accept-Language":
              "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
          }
        }
      );

    const $ =
      cheerio.load(response.data);

    const produtos = [];

    $(".ui-search-result__wrapper")
      .each((index, element) => {

        if (produtos.length >= 10) {
          return;
        }

        const titulo =
          $(element)
            .find(".poly-component__title")
            .first()
            .text()
            .trim();

        const preco =
          $(element)
            .find(".andes-money-amount__fraction")
            .first()
            .text()
            .trim();

        const link =
          $(element)
            .find("a")
            .first()
            .attr("href");

        const imagem =
          $(element)
            .find("img")
            .first()
            .attr("src") ||
          $(element)
            .find("img")
            .first()
            .attr("data-src");

        if (titulo) {

          produtos.push({
            titulo,
            preco:
              preco || null,
            link:
              link || null,
            imagem:
              imagem || null
          });
        }
      });

    return resposta(res, {

      sucesso:
        true,

      keyword,

      status_http:
        response.status,

      url_final:
        response.request?.res?.responseUrl ||
        url,

      quantidade:
        produtos.length,

      produtos
    });

  } catch (error) {

    return resposta(
      res,
      {

        sucesso:
          false,

        keyword,

        erro:
          error.message,

        status_http:
          error.response?.status ||
          null,

        url_final:
          error.response?.request?.res?.responseUrl ||
          null
      },
      500
    );
  }
});

/* =========================================================
   STATUS AFILIADO
========================================================= */

app.get(
  "/status-afiliado",
  (req, res) => {

    const credenciais =
      credenciaisConfiguradas();

    return resposta(res, {

      sucesso:
        true,

      servidor:
        "online",

      configuracao: {

        cookie_configurado:
          credenciais.cookieConfigurado,

        csrf_configurado:
          credenciais.csrfConfigurado,

        tag_configurada:
          credenciais.tagConfigurada
      },

      observacao:
        "Nenhum valor de credencial é exibido."
    });
  }
);

/* =========================================================
   VALIDAR AFILIADO
========================================================= */

app.get(
  "/validar-afiliado",
  async (req, res) => {

    const credenciais =
      credenciaisConfiguradas();

    if (!credenciais.cookieConfigurado) {

      return resposta(
        res,
        {
          sucesso: false,
          etapa: "configuracao",
          autenticado: false,

          erro:
            "ML_AFFILIATE_COOKIE ainda não está configurado no Render.",

          cookie_configurado: false,

          csrf_configurado:
            credenciais.csrfConfigurado,

          tag_configurada:
            credenciais.tagConfigurada
        },
        400
      );
    }

    if (!credenciais.csrfConfigurado) {

      return resposta(
        res,
        {
          sucesso: false,
          etapa: "configuracao",
          autenticado: false,

          erro:
            "ML_AFFILIATE_CSRF ainda não está configurado no Render.",

          cookie_configurado: true,

          csrf_configurado: false,

          tag_configurada:
            credenciais.tagConfigurada
        },
        400
      );
    }

    try {

      const response =
        await axios.get(
          `${ML_BASE_URL}/afiliados/hub?is_affiliate=true`,
          {
            timeout: 20000,
            maxRedirects: 5,

            headers:
              headersSessao(),

            validateStatus:
              () => true
          }
        );

      const status =
        response.status;

      const urlFinal =
        response.request?.res?.responseUrl ||
        null;

      const html =
        typeof response.data === "string"
          ? response.data
          : "";

      const $ =
        cheerio.load(html);

      const texto =
        $("body")
          .text()
          .replace(/\s+/g, " ")
          .trim();

      const sinaisLogin = [
        "Para continuar, acesse sua conta",
        "Já tenho conta",
        "Sou novo"
      ];

      const sinaisAfiliado = [
        "Compartilhe para ganhar dinheiro",
        "Afiliados",
        "Comissão",
        "Ganhos"
      ];

      const encontrouLogin =
        sinaisLogin.some(
          sinal =>
            texto
              .toLowerCase()
              .includes(
                sinal.toLowerCase()
              )
        );

      const encontrouAfiliado =
        sinaisAfiliado.some(
          sinal =>
            texto
              .toLowerCase()
              .includes(
                sinal.toLowerCase()
              )
        );

      const autenticado =
        status >= 200 &&
        status < 300 &&
        !encontrouLogin &&
        encontrouAfiliado;

      return resposta(res, {

        sucesso:
          true,

        autenticado,

        http_status:
          status,

        url_final:
          urlFinal,

        diagnostico: {

          encontrou_pagina_afiliados:
            encontrouAfiliado,

          encontrou_tela_login:
            encontrouLogin,

          sessao_aceita:
            autenticado,

          tag_configurada:
            credenciais.tagConfigurada
        },

        observacao:
          autenticado
            ? "O Mercado Livre aceitou a sessão enviada pelo Render."
            : "A sessão não foi reconhecida como autenticada na área de afiliados."
      });

    } catch (error) {

      return resposta(
        res,
        {

          sucesso: false,

          autenticado: false,

          etapa: "validacao",

          erro:
            error.message,

          http_status:
            error.response?.status ||
            null
        },
        500
      );
    }
  }
);

/* =========================================================
   TESTE CREATE LINK
========================================================= */

app.get(
  "/teste-afiliado",
  async (req, res) => {

    const itemId =
      limparItemId(
        req.query.item_id
      );

    if (!itemId) {

      return resposta(
        res,
        {
          sucesso: false,

          erro:
            "Informe ?item_id=MLB..."
        },
        400
      );
    }

    const credenciais =
      credenciaisConfiguradas();

    /* =====================================================
       CONFIGURAÇÕES
    ===================================================== */

    if (!credenciais.cookieConfigurado) {

      return resposta(
        res,
        {
          sucesso: false,
          etapa: "configuracao",

          erro:
            "ML_AFFILIATE_COOKIE não configurado.",

          cookie_configurado: false,

          csrf_configurado:
            credenciais.csrfConfigurado,

          tag_configurada:
            credenciais.tagConfigurada
        },
        400
      );
    }

    if (!credenciais.csrfConfigurado) {

      return resposta(
        res,
        {
          sucesso: false,
          etapa: "configuracao",

          erro:
            "ML_AFFILIATE_CSRF não configurado.",

          cookie_configurado: true,

          csrf_configurado: false,

          tag_configurada:
            credenciais.tagConfigurada
        },
        400
      );
    }

    if (!credenciais.tagConfigurada) {

      return resposta(
        res,
        {
          sucesso: false,
          etapa: "configuracao",

          erro:
            "ML_AFFILIATE_TAG não configurada no Render.",

          cookie_configurado: true,

          csrf_configurado: true,

          tag_configurada: false
        },
        400
      );
    }

    /* =====================================================
       URL REAL DO PRODUTO
    ===================================================== */

    /*
      IMPORTANTE:

      O Mercado Livre não quer:

      https://www.mercadolivre.com.br/MLB-4690712449

      Ele quer a URL do produto de catálogo:

      /compressor-portatil-.../p/MLB57468821

      Vamos usar exatamente a estrutura que
      apareceu na requisição createLink capturada
      no navegador.
    */

    const originUrl =
      "www.mercadolivre.com.br/compressor-portatil-car-air-pump-digital-com-visor-para-carro-moto-bike-calibrador-de-pneu-multifuncional/p/MLB57468821";

    /* =====================================================
       PAYLOAD
    ===================================================== */

    const payload = {

      itemId:
        itemId,

      itemAddToList:
        itemId,

      tag:
        credenciais.tag,

      type:
        "product",

      buyBoxWinner:
        itemId,

      extraCommission:
        "true",

      urls: [
        originUrl
      ]
    };

    try {

      const response =
        await axios.post(
          ML_AFFILIATE_URL,

          payload,

          {
            timeout: 20000,

            headers:
              headersSessao(),

            validateStatus:
              () => true
          }
        );

      return resposta(
        res,
        {

          sucesso:
            response.status >= 200 &&
            response.status < 300,

          http_status:
            response.status,

          item_id:
            itemId,

          origin_url:
            originUrl,

          resposta:
            response.data
        },
        response.status
      );

    } catch (error) {

      return resposta(
        res,
        {

          sucesso:
            false,

          etapa:
            "create_link",

          http_status:
            error.response?.status ||
            null,

          item_id:
            itemId,

          origin_url:
            originUrl,

          erro:
            error.message,

          resposta:
            error.response?.data ||
            null
        },
        error.response?.status ||
        500
      );
    }
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `DS Garage Scraper rodando na porta ${PORT}`
    );

  }
);

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;

const AFFILIATE_ENDPOINT =
  "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

function resposta(res, status, dados) {
  return res.status(status).json(dados);
}

function obterCredenciais() {
  return {
    cookie: String(process.env.ML_AFFILIATE_COOKIE || "").trim(),
    csrf: String(process.env.ML_AFFILIATE_CSRF || "").trim(),
    tag: String(process.env.ML_AFFILIATE_TAG || "").trim()
  };
}

function validarConfiguracao() {
  const credenciais = obterCredenciais();

  return {
    ok:
      credenciais.cookie.length > 0 &&
      credenciais.csrf.length > 0 &&
      credenciais.tag.length > 0,
    cookie_configurado: credenciais.cookie.length > 0,
    csrf_configurado: credenciais.csrf.length > 0,
    tag_configurada: credenciais.tag.length > 0
  };
}

function limparOriginUrl(url) {
  if (!url) return null;

  let valor = String(url).trim();

  // Remove protocolo
  valor = valor.replace(/^https?:\/\//i, "");

  // Remove parâmetros e fragmentos.
  // O createLink funciona melhor com a URL limpa da página.
  valor = valor.split("?")[0];
  valor = valor.split("#")[0];

  // Remove barra final
  valor = valor.replace(/\/+$/, "");

  // Garante domínio Mercado Livre
  if (!/^www\.mercadolivre\.com\.br\//i.test(valor)) {
    return null;
  }

  return valor;
}

function extrairOriginDoItem(itemId, urlRecebida) {
  if (urlRecebida) {
    return limparOriginUrl(urlRecebida);
  }

  /*
   * Não tentamos inventar a URL do produto.
   *
   * O Mercado Livre exige a URL real/canônica do produto
   * no campo "urls" do createLink.
   */
  return null;
}

async function criarLinkAfiliado({
  itemId,
  originUrl,
  credenciais
}) {
  const payload = {
    itemId: itemId,
    itemAddToList: itemId,
    tag: credenciais.tag,
    type: "product",
    buyBoxWinner: itemId,
    extraCommission: "true",
    urls: [originUrl]
  };

  const response = await axios.post(
    AFFILIATE_ENDPOINT,
    payload,
    {
      timeout: 30000,
      validateStatus: () => true,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Origin: "https://www.mercadolivre.com.br",
        Referer:
          "https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
        "X-CSRF-Token": credenciais.csrf,
        Cookie: credenciais.cookie
      },
      data: payload
    }
  );

  return {
    http_status: response.status,
    payload_enviado: payload,
    resposta: response.data
  };
}

/*
|--------------------------------------------------------------------------
| HOME
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  return resposta(res, 200, {
    sucesso: true,
    servidor: "online",
    projeto: "DS Garage - Mercado Livre Afiliados",
    versao: "2.6",
    endpoints: [
      "/",
      "/buscar",
      "/status-afiliado",
      "/validar-afiliado",
      "/teste-afiliado"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| BUSCAR
|--------------------------------------------------------------------------
|
| Endpoint simples para conferir se o servidor está online.
|
*/

app.get("/buscar", (req, res) => {
  return resposta(res, 200, {
    sucesso: true,
    servidor: "online",
    mensagem: "Servidor DS Garage funcionando."
  });
});

/*
|--------------------------------------------------------------------------
| STATUS DAS CREDENCIAIS
|--------------------------------------------------------------------------
|
| Nunca mostramos os valores das credenciais.
|
*/

app.get("/status-afiliado", (req, res) => {
  const config = validarConfiguracao();

  return resposta(res, 200, {
    sucesso: true,
    servidor: "online",
    configuracao: config,
    observacao: "Nenhum valor de credencial é exibido."
  });
});

/*
|--------------------------------------------------------------------------
| VALIDAR SESSÃO DO AFILIADO
|--------------------------------------------------------------------------
*/

app.get("/validar-afiliado", async (req, res) => {
  const credenciais = obterCredenciais();

  if (!credenciais.cookie) {
    return resposta(res, 400, {
      sucesso: false,
      etapa: "configuracao",
      autenticado: false,
      erro: "ML_AFFILIATE_COOKIE ainda não está configurado no Render.",
      cookie_configurado: false,
      csrf_configurado: credenciais.csrf.length > 0
    });
  }

  if (!credenciais.csrf) {
    return resposta(res, 400, {
      sucesso: false,
      etapa: "configuracao",
      autenticado: false,
      erro: "ML_AFFILIATE_CSRF ainda não está configurado no Render.",
      cookie_configurado: true,
      csrf_configurado: false
    });
  }

  try {
    const response = await axios.get(
      "https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true",
      {
        timeout: 30000,
        maxRedirects: 10,
        validateStatus: () => true,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
          Referer: "https://www.mercadolivre.com.br/",
          Cookie: credenciais.cookie
        }
      }
    );

    const html = String(response.data || "");

    const encontrouPaginaAfiliados =
      html.includes("/afiliados/") ||
      html.toLowerCase().includes("afiliados");

    const encontrouTelaLogin =
      html.includes("Para continuar, acesse sua conta") ||
      html.includes("login") && html.includes("account-verification");

    const sessaoAceita =
      response.status >= 200 &&
      response.status < 400 &&
      !encontrouTelaLogin;

    return resposta(res, 200, {
      sucesso: true,
      autenticado: sessaoAceita,
      http_status: response.status,
      url_final:
        response.request?.res?.responseUrl ||
        "https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true",
      diagnostico: {
        encontrou_pagina_afiliados: encontrouPaginaAfiliados,
        encontrou_tela_login: encontrouTelaLogin,
        sessao_aceita: sessaoAceita
      },
      observacao: sessaoAceita
        ? "O Mercado Livre aceitou a sessão enviada pelo Render."
        : "O Mercado Livre não confirmou a sessão enviada pelo Render."
    });
  } catch (error) {
    return resposta(res, 500, {
      sucesso: false,
      etapa: "validar_sessao",
      autenticado: false,
      erro: error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| TESTE DE CREATE LINK
|--------------------------------------------------------------------------
|
| Agora a URL do produto NÃO é fixa.
|
| Exemplo:
|
| /teste-afiliado?item_id=MLB3506502529&origin_url=https://www.mercadolivre.com.br/slug-do-produto/p/MLB23445212
|
| Também aceitamos "url" no lugar de "origin_url".
|
*/

app.get("/teste-afiliado", async (req, res) => {
  const itemId = String(req.query.item_id || "").trim();

  const urlRecebida = String(
    req.query.origin_url ||
    req.query.url ||
    ""
  ).trim();

  if (!itemId) {
    return resposta(res, 400, {
      sucesso: false,
      erro: "Informe ?item_id=MLB..."
    });
  }

  const credenciais = obterCredenciais();

  if (!credenciais.cookie) {
    return resposta(res, 400, {
      sucesso: false,
      etapa: "configuracao",
      autenticado: false,
      erro: "ML_AFFILIATE_COOKIE ainda não está configurado no Render.",
      cookie_configurado: false,
      csrf_configurado: credenciais.csrf.length > 0,
      tag_configurada: credenciais.tag.length > 0
    });
  }

  if (!credenciais.csrf) {
    return resposta(res, 400, {
      sucesso: false,
      etapa: "configuracao",
      autenticado: false,
      erro: "ML_AFFILIATE_CSRF ainda não está configurado no Render.",
      cookie_configurado: true,
      csrf_configurado: false,
      tag_configurada: credenciais.tag.length > 0
    });
  }

  if (!credenciais.tag) {
    return resposta(res, 400, {
      sucesso: false,
      etapa: "configuracao",
      autenticado: false,
      erro: "ML_AFFILIATE_TAG ainda não está configurado no Render.",
      cookie_configurado: true,
      csrf_configurado: true,
      tag_configurada: false
    });
  }

  if (!urlRecebida) {
    return resposta(res, 400, {
      sucesso: false,
      etapa: "origin_url",
      erro:
        "Informe a URL real do produto em &origin_url=. A URL precisa ser a página /p/MLB... do produto.",
      exemplo:
        "/teste-afiliado?item_id=MLB3506502529&origin_url=https://www.mercadolivre.com.br/nome-do-produto/p/MLB23445212"
    });
  }

  const originUrl = extrairOriginDoItem(
    itemId,
    urlRecebida
  );

  if (!originUrl) {
    return resposta(res, 400, {
      sucesso: false,
      etapa: "origin_url",
      erro:
        "A origin_url não é válida. Use uma URL do Mercado Livre começando com www.mercadolivre.com.br/."
    });
  }

  try {
    const resultado = await criarLinkAfiliado({
      itemId,
      originUrl,
      credenciais
    });

    return resposta(res, 200, {
      sucesso:
        resultado.resposta?.total_success > 0 ||
        resultado.resposta?.urls?.some(
          item => item?.created === true
        ) === true,

      http_status: resultado.http_status,

      item_id: itemId,

      origin_url: originUrl,

      tag: credenciais.tag,

      resposta: resultado.resposta
    });
  } catch (error) {
    return resposta(res, 500, {
      sucesso: false,
      etapa: "createLink",
      item_id: itemId,
      origin_url: originUrl,
      erro: error.message,
      detalhes: error.response?.data || null,
      http_status: error.response?.status || null
    });
  }
});

/*
|--------------------------------------------------------------------------
| TRATAMENTO DE ERROS
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  return resposta(res, 404, {
    sucesso: false,
    erro: "Endpoint não encontrado.",
    rota: req.path
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  return resposta(res, 500, {
    sucesso: false,
    erro: error.message || "Erro interno do servidor."
  });
});

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `DS Garage afiliados rodando na porta ${PORT}`
  );
});

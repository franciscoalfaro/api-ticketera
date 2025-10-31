import dotenv from "dotenv";
dotenv.config();

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;

const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

/**
 * Genera un token de acceso para Microsoft Graph (sin axios)
 */
export const getGraphAccessToken = async () => {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Error al obtener token Graph:", errorData);
      throw new Error(`Fallo autenticación: ${errorData.error_description}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("❌ Error en getGraphAccessToken:", error);
    throw new Error("No se pudo obtener el token de Microsoft Graph");
  }
};

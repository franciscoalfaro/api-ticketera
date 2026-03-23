import { ConfidentialClientApplication } from "@azure/msal-node";

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

export const getAuthUrl = async (redirectUri) => {
  const authCodeUrlParameters = {
    scopes: ["openid", "profile", "User.Read"],
    redirectUri,
  };

  return await cca.getAuthCodeUrl(authCodeUrlParameters);
};

export const getTokenByAuthCode = async (authCode, redirectUri) => {
  const tokenRequest = {
    code: authCode,
    scopes: ["openid", "profile", "User.Read"],
    redirectUri,
  };

  return await cca.acquireTokenByCode(tokenRequest);
};

export const getMicrosoftProfile = async (accessToken) => {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName,jobTitle",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`No se pudo obtener perfil de Microsoft: ${response.status} ${errorBody}`);
  }

  return await response.json();
};

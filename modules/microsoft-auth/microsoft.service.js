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

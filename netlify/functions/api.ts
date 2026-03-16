import serverlessHttp from "serverless-http";
import { createApp } from "../../server/app";

let handler: ReturnType<typeof serverlessHttp> | null = null;

export const handler = async (event: any, context: any) => {
  if (!handler) {
    const { app } = await createApp();
    handler = serverlessHttp(app);
  }
  return (handler as any)(event, context);
};

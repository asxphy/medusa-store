import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
    projectConfig: {
        databaseUrl: process.env.DATABASE_URL,
        http: {
            storeCors: process.env.STORE_CORS!,
            adminCors: process.env.ADMIN_CORS!,
            authCors: process.env.AUTH_CORS!,
            jwtSecret: process.env.JWT_SECRET || "supersecret",
            cookieSecret: process.env.COOKIE_SECRET || "supersecret",
        },
    },
    modules: [
        {
            resolve: "@medusajs/medusa/payment",
            options: {
                providers: [
                    {
                        resolve: "./src/modules/hyperswitch",
                        id: "hyperswitch",
                        options: {
                            apiKey: "snd_M3DDZ3PhRkhm0zG0bK36QkAdngrJpMzRzVcKZh1wGKvjiDuDIrETRZT5TUEp8UeL",
                        },
                    },
                ],
            },
        },
    ],
});

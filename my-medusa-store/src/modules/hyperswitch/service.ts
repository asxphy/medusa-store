import {
    AbstractPaymentProvider,
    isPaymentProviderError,
    MedusaError,
    PaymentSessionStatus,
    BigNumber,
} from "@medusajs/framework/utils";
import {
    CreatePaymentProviderSession,
    Logger,
    PaymentProviderError,
    PaymentProviderSessionResponse,
    UpdatePaymentProviderSession,
    ProviderWebhookPayload,
    WebhookActionResult,
} from "@medusajs/framework/types";

import hyperswitch from "@juspay-tech/hyperswitch-node";
import { PaymentIntentOptions } from "./types";

type Options = {
    apiKey: string;
};

type InjectedDependencies = {
    logger: Logger;
};
class HyperswitchService extends AbstractPaymentProvider<Options> {
    static identifier = "hyperswitch";

    protected logger_: Logger;

    protected options_: Options;

    protected client;

    static validateOptions(options: Record<any, any>): void | never {
        if (!options.apiKey) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "API key is required in the provider's options."
            );
        }
    }
    constructor({ logger }: InjectedDependencies, options: Options) {
        // @ts-ignore
        super(...arguments);

        this.logger_ = logger;
        this.options_ = options;

        this.client = hyperswitch(options.apiKey);
    }

    async capturePayment(
        paymentData: Record<string, unknown>
    ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
        const payment_id = paymentData.id;

        try {
            const newData = await this.client.paymentIntents.capture(
                payment_id
            );

            return {
                ...newData,
                id: payment_id,
            };
        } catch (e) {
            return {
                error: e,
                code: "unknown",
                detail: e,
            };
        }
    }

    async getPaymentStatus(
        paymentSessionData: Record<string, unknown>
    ): Promise<PaymentSessionStatus> {
        const id = paymentSessionData.id as string;
        const paymentIntent = await this.client.paymentIntents.retrieve(id);

        switch (paymentIntent.status) {
            case "requires_payment_method":
            case "requires_confirmation":
            case "processing":
                return PaymentSessionStatus.PENDING;
            case "requires_action":
                return PaymentSessionStatus.REQUIRES_MORE;
            case "canceled":
                return PaymentSessionStatus.CANCELED;
            case "requires_capture":
            case "succeeded":
                return PaymentSessionStatus.AUTHORIZED;
            default:
                return PaymentSessionStatus.PENDING;
        }
    }
    async authorizePayment(
        paymentSessionData: Record<string, unknown>,
        context: Record<string, unknown>
    ): Promise<
        | PaymentProviderError
        | {
              status: PaymentSessionStatus;
              data: PaymentProviderSessionResponse["data"];
          }
    > {
        const status = await this.getPaymentStatus(paymentSessionData);
        return { data: paymentSessionData, status };
    }

    async cancelPayment(
        paymentData: Record<string, unknown>
    ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
        const payment_id = paymentData.id;

        try {
            const paymentData = await this.client.paymentIntents.cancel(
                payment_id
            );
        } catch (e) {
            return {
                error: e,
                code: "unknown",
                detail: e,
            };
        }
    }

    async initiatePayment(
        context: CreatePaymentProviderSession
    ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
        console.log(context);
        const { context: cart_context, currency_code, amount } = context;

        try {
            const response = await this.client.paymentIntents.create({
                amount,
                currency: currency_code,
                cart_context,
            });

            return {
                ...response,
                data: {
                    id: response.payment_id,
                },
            };
        } catch (err) {
            return {
                error: err,
                code: "unknown",
                detail: err,
            };
        }
    }
    async deletePayment(
        paymentSessionData: Record<string, unknown>
    ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
        try {
            await this.cancelPayment(paymentSessionData);
        } catch (e) {
            return {
                error: e,
                code: "unknown",
                detail: e,
            };
        }
    }
    async refundPayment(
        paymentData: Record<string, unknown>,
        refundAmount: number
    ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
        const payment_id = paymentData.id;

        try {
            const newData = await this.client.refund.create(
                payment_id,
                refundAmount
            );

            return {
                ...newData,
                id: payment_id,
            };
        } catch (e) {
            return {
                error: e,
                code: "unknown",
                detail: e,
            };
        }
    }

    async retrievePayment(
        paymentSessionData: Record<string, unknown>
    ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
        const payment_id = paymentSessionData.id;

        try {
            return await this.client.paymentIntents.retrieve(payment_id);
        } catch (e) {
            return {
                error: e,
                code: "unknown",
                detail: e,
            };
        }
    }

    async updatePayment(
        context: UpdatePaymentProviderSession
    ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
        const {
            amount,
            currency_code,
            context: customerDetails,
            data,
        } = context;
        const payment_id = data.id;

        try {
            const response = await this.client.update(payment_id, {
                amount,
                currency_code,
                customerDetails,
            });

            return {
                ...response,
                data: {
                    id: response.id,
                },
            };
        } catch (e) {
            return {
                error: e,
                code: "unknown",
                detail: e,
            };
        }
    }

    async getWebhookActionAndData(
        payload: ProviderWebhookPayload["payload"]
    ): Promise<WebhookActionResult> {
        const { data, rawData, headers } = payload;

        try {
            switch (data.event_type) {
                case "authorized_amount":
                    return {
                        action: "authorized",
                        data: {
                            session_id: (data.metadata as Record<string, any>)
                                .session_id,
                            amount: new BigNumber(data.amount as number),
                        },
                    };
                case "success":
                    return {
                        action: "captured",
                        data: {
                            session_id: (data.metadata as Record<string, any>)
                                .session_id,
                            amount: new BigNumber(data.amount as number),
                        },
                    };
                default:
                    return {
                        action: "not_supported",
                    };
            }
        } catch (e) {
            return {
                action: "failed",
                data: {
                    session_id: (data.metadata as Record<string, any>)
                        .session_id,
                    amount: new BigNumber(data.amount as number),
                },
            };
        }
    }
}

export default HyperswitchService;

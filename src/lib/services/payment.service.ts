// KLIK&GO — Payment Service (stub)
// Schema migration pending - minimal exports

export interface PaymentIntent {
  id: string;
  orderId: string;
  amountCents: number;
  method: string;
  status: string;
  providerRef: string | null;
  clientSecret: string | null;
}

export interface IPaymentService {
  createPayment(orderId: string, amountCents: number, method: string): Promise<PaymentIntent>;
  confirmPayment(orderId: string): Promise<PaymentIntent>;
  refundPayment(orderId: string): Promise<PaymentIntent>;
  getPaymentStatus(orderId: string): Promise<PaymentIntent | null>;
}

class StubPaymentService implements IPaymentService {
  async createPayment(orderId: string, amountCents: number, method: string): Promise<PaymentIntent> {
    console.log(`[STUB PAYMENT] Create: order=${orderId}, ${amountCents}c, ${method}`);
    return { id: `stub_${Date.now()}`, orderId, amountCents, method, status: "PENDING", providerRef: null, clientSecret: null };
  }
  async confirmPayment(orderId: string): Promise<PaymentIntent> {
    console.log(`[STUB PAYMENT] Confirm: order=${orderId}`);
    return { id: "stub", orderId, amountCents: 0, method: "STUB", status: "COMPLETED", providerRef: null, clientSecret: null };
  }
  async refundPayment(orderId: string): Promise<PaymentIntent> {
    console.log(`[STUB PAYMENT] Refund: order=${orderId}`);
    return { id: "stub", orderId, amountCents: 0, method: "STUB", status: "REFUNDED", providerRef: null, clientSecret: null };
  }
  async getPaymentStatus(_orderId: string): Promise<PaymentIntent | null> {
    return null;
  }
}

export const paymentService: IPaymentService = new StubPaymentService();

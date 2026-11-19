'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResponse } from '../../contracts/api';
import type { CreatedOrderData, TrackedOrderData } from '../../contracts/orders';
import type { BankDestination } from '../../contracts/payments';
import { usePaymentOptions } from '../../hooks/usePaymentOptions';
import { SITE_CONFIG } from '../../config/site.config';
import { paymentRejectionNotice } from '../../lib/order-presentation';

import { catalogShippingFee } from '../../domain/orders/checkout-pricing';

import { checkoutRequestKey, completeCheckoutRequest } from '../../lib/checkout-request';
import { CHECKOUT_CONTACT_FIELDS, validateCheckoutContact, type CheckoutContactField, type CheckoutContactErrors } from '../../lib/checkout-validation';
import { useCart, CartItem } from '../../context/CartContext';


type CheckoutStep =
  | 'FORM'
  | 'VIETQR_PAYMENT'
  | 'PAYMENT_VERIFIED';

export function useCheckout() {
  const {
    isCheckoutOpen,
    closeCheckout,
    items,
    directBuyProduct,
    clearCart,
    updateCheckoutQuantity,
  } = useCart();

  const [submittedItems, setSubmittedItems] = useState<CartItem[] | null>(null);

  // Xác định danh sách sản phẩm cần thanh toán (Mua ngay hoặc từ giỏ)
  const checkoutItems: CartItem[] = submittedItems ?? (directBuyProduct ? [directBuyProduct] : items);

  // Kiểm tra đơn có sản phẩm CUSTOM_PRINT không
  const isCustomPrintItem = (item: CartItem) => {
    const raw = item.product as { itemType?: string; categorySlug?: string };
    return raw.itemType === 'CUSTOM_PRINT' || raw.categorySlug === 'custom-print' || item.product.id.startsWith('custom-');
  };
  const hasCustomPrint = checkoutItems.some(isCustomPrintItem);

  // Tổng tiền hàng
  const subtotal = checkoutItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const shippingFee = catalogShippingFee(subtotal);
  const totalAmount = subtotal + shippingFee;

  // Bước hiện tại trong luồng
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('FORM');

  // Thông tin khách hàng
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [validatedFields, setValidatedFields] = useState<CheckoutContactField[]>([]);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const paymentMethod = 'VIETQR' as const;

  // Thông tin đơn hàng sau khi tạo từ Server
  const [orderId, setOrderId] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [finalTotal, setFinalTotal] = useState(0);
  const [receivingBank,setReceivingBank]=useState<BankDestination | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const pendingRequest = useRef<{ payload: string; key: string } | null>(null);
  const checkoutRevision = useRef(0);
  const [optionsRevision,setOptionsRevision]=useState(0);
  const paymentOptions=usePaymentOptions(isCheckoutOpen,optionsRevision);
  const submittedFromCart = useRef(false);

  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isDeclaringPayment, setIsDeclaringPayment] = useState(false);
  const [hasDeclaredPayment, setHasDeclaredPayment] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [isPaymentUnavailable, setIsPaymentUnavailable] = useState(false);
  const paymentCheck = useRef<AbortController | null>(null);
  const paymentDeclarationLock = useRef(false);

  // Trạng thái copy text
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const contactValidation = validateCheckoutContact({ fullName, email, phone, address });
  const fieldErrors: CheckoutContactErrors = {};
  for (const field of CHECKOUT_CONTACT_FIELDS) {
    if (contactSubmitted || validatedFields.includes(field)) fieldErrors[field] = contactValidation[field];
  }
  const showContactSummary = contactSubmitted && CHECKOUT_CONTACT_FIELDS.some(field => Boolean(contactValidation[field]));

  const handleFieldBlur = (field: CheckoutContactField) => {
    setValidatedFields(current => current.includes(field) ? current : [...current, field]);
  };

  const handleClose = useCallback(() => {
    checkoutRevision.current += 1;
    setOptionsRevision(value=>value+1);
    paymentCheck.current?.abort();
    paymentCheck.current = null;
    closeCheckout();
    setCurrentStep('FORM');
    setSubmittedItems(null);
    setOrderId('');
    setTrackingToken('');
    setFinalTotal(0);
    setReceivingBank(null);
    setErrorMessage('');
    setPaymentNotice('');
    setHasDeclaredPayment(false);
    setIsDeclaringPayment(false);
    paymentDeclarationLock.current = false;
    setIsPaymentUnavailable(false);
    setIsCheckingPayment(false);
    setCopiedField(null);
    setValidatedFields([]);
    setContactSubmitted(false);
    submittedFromCart.current = false;
  }, [closeCheckout]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setErrorMessage('Không thể sao chép. Vui lòng chọn và sao chép nội dung trực tiếp.');
    }
  };

  // 1. Gửi form đặt hàng ban đầu tới Server API
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionLock.current) return;
    setErrorMessage('');

    setContactSubmitted(true);
    if (CHECKOUT_CONTACT_FIELDS.some(field => Boolean(contactValidation[field]))) {
      const form = e.currentTarget;
      window.requestAnimationFrame(() => {
        if (!form.isConnected) return;
        form.querySelector<HTMLElement>('[data-checkout-validation]')?.focus();
      });
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    const revision = checkoutRevision.current;

    try {
      const payload = JSON.stringify({
          customerName: fullName.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          shippingAddress: address.trim(),
          customerNote: note.trim(),
          paymentMethod: paymentMethod,
          items: checkoutItems.map((item) => ({
            productId: item.product.id,
            productVariantId: item.variantId ?? item.product.variants.find(variant => variant.name === item.selectedColor)?.id,
            itemType: isCustomPrintItem(item) ? 'CUSTOM_PRINT' : 'READY_PRODUCT',
            itemName: item.product.title,
            quantity: item.quantity,
            unitPrice: item.product.price,
            color: item.product.variants.find(variant => variant.name === item.selectedColor)?.color ?? item.selectedColor,
            material: item.product.material,
          })),
        });
      if (pendingRequest.current?.payload !== payload) {
        pendingRequest.current = { payload, key: await checkoutRequestKey(payload) };
      }
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pendingRequest.current.key },
        body: payload,
      });

      const resData: ApiResponse<CreatedOrderData> = await response.json();
      if (revision !== checkoutRevision.current) return;
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Tạo đơn hàng thất bại.');
      }

      completeCheckoutRequest(pendingRequest.current.key);
      pendingRequest.current = null;
      const createdOrderNumber = resData.data.orderNumber;
      const orderGrandTotal = resData.data.grandTotal;

      setSubmittedItems(checkoutItems);
      submittedFromCart.current = !directBuyProduct;
      setOrderId(createdOrderNumber);
      setTrackingToken(resData.data.trackingToken);
      setHasDeclaredPayment(false);
      setFinalTotal(orderGrandTotal);
      setReceivingBank(resData.data.payment?.receivingBank ?? null);
      setPaymentNotice('');
      setIsPaymentUnavailable(false);

      const copy = SITE_CONFIG.checkout.payment;
      if (resData.data.orderStatus === 'CANCELLED' || resData.data.payment?.verificationStatus === 'REFUNDED') {
        setCurrentStep('VIETQR_PAYMENT');
        setIsPaymentUnavailable(true);
        setPaymentNotice(resData.data.orderStatus === 'CANCELLED' ? copy.cancelledMessage : copy.refundedMessage);
      } else if (resData.data.paymentStatus === 'PAID' && resData.data.payment?.verificationStatus === 'VERIFIED') {
        if (submittedFromCart.current) clearCart();
        setCurrentStep('PAYMENT_VERIFIED');
      } else if (resData.data.paymentStatus === 'PAID') {
        setCurrentStep('VIETQR_PAYMENT');
        setIsPaymentUnavailable(true);
        setPaymentNotice(copy.reviewMessage);
      } else {
        if (!directBuyProduct) clearCart();
        setCurrentStep('VIETQR_PAYMENT');
      }
    } catch (err: unknown) {
      if (revision === checkoutRevision.current) {
        setErrorMessage(err instanceof Error ? err.message : 'Lỗi hệ thống khi tạo đơn hàng.');
      }
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  // Chỉ đọc kết quả đối soát từ server; thao tác kiểm tra không khai báo hay xác nhận tiền.
  const handleCheckStatus = useCallback(async (quiet = false) => {
    if (!orderId || paymentCheck.current) return;
    const controller = new AbortController();
    paymentCheck.current = controller;
    setIsCheckingPayment(true);
    if (!quiet) setErrorMessage('');
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(trackingToken)}`, {
        cache: 'no-store', signal: controller.signal,
      });
      const result: ApiResponse<TrackedOrderData> = await res.json();
      if (controller.signal.aborted || paymentCheck.current !== controller) return;
      if (!res.ok || !result.success) throw new Error('Payment status unavailable');
      const order = result.data;
      const copy = SITE_CONFIG.checkout.payment;
      const paymentDeclared = order.orderStatus === 'PENDING_PAYMENT'
        && order.paymentStatus === 'UNPAID'
        && order.payment?.verificationStatus === 'PENDING'
        && Boolean(order.payment.transferredAt);
      setHasDeclaredPayment(paymentDeclared);
      if (order.orderStatus === 'CANCELLED' || order.payment?.verificationStatus === 'REFUNDED') {
        setIsPaymentUnavailable(true);
        setPaymentNotice(order.orderStatus === 'CANCELLED' ? copy.cancelledMessage : copy.refundedMessage);
      } else if (order.paymentStatus === 'PAID' && order.payment?.verificationStatus === 'VERIFIED') {
        if (submittedFromCart.current) clearCart();
        setCurrentStep('PAYMENT_VERIFIED');
        setErrorMessage('');
      } else if (order.payment?.verificationStatus === 'REJECTED') {
        setIsPaymentUnavailable(false);
        setPaymentNotice(paymentRejectionNotice(order.payment.rejectionReason));
      } else {
        setIsPaymentUnavailable(false);
        setPaymentNotice(previous => paymentDeclared ? 'Đã gửi khai báo cho MinhLab. Đơn đang chờ đối soát ngân hàng.' : !quiet ? copy.pendingMessage
          : [copy.cancelledMessage, copy.refundedMessage, copy.reviewMessage].includes(previous) ? '' : previous);
      }
    } catch {
      if (!quiet && paymentCheck.current === controller) setErrorMessage(SITE_CONFIG.checkout.payment.checkError);
    } finally {
      window.clearTimeout(timeout);
      if (paymentCheck.current === controller) {
        paymentCheck.current = null;
        setIsCheckingPayment(false);
      }
    }
  }, [clearCart, orderId, trackingToken]);

  const handleDeclarePayment = useCallback(async () => {
    if (!orderId || !trackingToken || isPaymentUnavailable || hasDeclaredPayment || paymentDeclarationLock.current) return;
    const revision = checkoutRevision.current;
    paymentDeclarationLock.current = true;
    setIsDeclaringPayment(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/payments/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderId, transactionReference: orderId, trackingToken }),
      });
      const result: ApiResponse<unknown> = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Không gửi được khai báo chuyển khoản.');
      if (revision !== checkoutRevision.current) return;
      setHasDeclaredPayment(true);
      setPaymentNotice('Đã gửi khai báo cho MinhLab. Đơn vẫn chờ nhân viên đối soát ngân hàng.');
    } catch (error: unknown) {
      if (revision === checkoutRevision.current) {
        setErrorMessage(error instanceof Error ? error.message : 'Không gửi được khai báo chuyển khoản.');
      }
    } finally {
      if (revision === checkoutRevision.current) {
        paymentDeclarationLock.current = false;
        setIsDeclaringPayment(false);
      }
    }
  }, [hasDeclaredPayment, isPaymentUnavailable, orderId, trackingToken]);

  useEffect(() => {
    if (!isCheckoutOpen || currentStep !== 'VIETQR_PAYMENT') return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void handleCheckStatus(true);
    };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      paymentCheck.current?.abort();
    };
  }, [currentStep, handleCheckStatus, isCheckoutOpen]);

  const handleQuantityChange = (item: CartItem, quantity: number) => {
    if (currentStep !== 'FORM' || isSubmitting) return;
    updateCheckoutQuantity(item.product.id, quantity, item.variantId ?? item.selectedColor);
  };

  const trackingHref = trackingToken
    ? `/theo-doi-don?order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(trackingToken)}`
    : null;

  return {
    handleClose,
    receivingBank,
    vietQrAvailable:paymentOptions.vietQr,
    loadingPaymentOptions:paymentOptions.loading,
    currentStep,
    orderId,
    errorMessage,
    handleCreateOrder,
    fieldErrors,
    showContactSummary,
    handleFieldBlur,
    checkoutItems,
    handleQuantityChange,
    isCustomPrintItem,
    fullName,
    setFullName,
    email,
    setEmail,
    phone,
    setPhone,
    note,
    setNote,
    address,
    setAddress,
    hasCustomPrint,
    paymentMethod,
    shippingFee,
    totalAmount,
    isSubmitting,
    finalTotal,
    copyToClipboard,
    copiedField,
    isCheckingPayment,
    isDeclaringPayment,
    hasDeclaredPayment,
    paymentNotice,
    isPaymentUnavailable,
    trackingHref,
    handleCheckStatus,
    handleDeclarePayment,
    isCheckoutOpen,
  };
}

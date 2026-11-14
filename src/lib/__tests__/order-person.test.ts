// @vitest-environment node
// Qui une commande nomme (src/lib/services/orders/order-person.ts) : l'identité saisie d'une
// commande invitée, sinon la ligne users. Règle pure, la même pour tous les lecteurs.
import { describe, expect, it } from "vitest";

import {
  orderClientKey,
  orderClientName,
  orderCustomerNumber,
  orderPerson,
  orderPersonName,
  shopOrderPerson,
  splitOrderPerson,
  typedGuestPerson,
  withOrderPersonName,
} from "@/lib/services/orders/order-person";

const ROW = { firstName: "Samir", lastName: "Benali", phone: "+33672255353" };
const TYPED = {
  placedAsGuest: true,
  customerFirstName: "Inès",
  customerLastName: "Typée",
  customerPhone: "+33711223344",
};
const MEMBER = {
  placedAsGuest: false,
  customerFirstName: null,
  customerLastName: null,
  customerPhone: null,
};
/** Guest order placed before C1-INVITES: marked by the migration, no identity typed on the order. */
const LEGACY_GUEST = { ...MEMBER, placedAsGuest: true };

describe("typedGuestPerson", () => {
  it("une commande invitée avec identité saisie : cette identité", () => {
    expect(typedGuestPerson(TYPED)).toEqual({
      firstName: "Inès",
      lastName: "Typée",
      phone: "+33711223344",
    });
  });

  it("sans téléphone saisi : aucun téléphone, jamais celui de la ligne", () => {
    expect(typedGuestPerson({ ...TYPED, customerPhone: null })?.phone).toBeNull();
    expect(orderPerson({ ...TYPED, customerPhone: null, user: ROW }).phone).toBeNull();
  });

  it.each([
    ["commande d'un membre", MEMBER],
    ["commande invitée d'avant C1-INVITES", LEGACY_GUEST],
    ["colonnes saisies sans le marqueur invité", { ...TYPED, placedAsGuest: false }],
    ["nom saisi incomplet", { ...TYPED, customerLastName: null }],
  ])("%s : la ligne users", (_label, columns) => {
    expect(typedGuestPerson(columns)).toBeNull();
    expect(orderPerson({ ...columns, user: ROW })).toEqual(ROW);
  });
});

describe("lecteurs", () => {
  it("nom, « Prénom.N » et personne côté boutique d'une commande invitée", () => {
    expect(orderPersonName({ ...TYPED, user: ROW })).toEqual({
      firstName: "Inès",
      lastName: "Typée",
    });
    expect(orderClientName({ ...TYPED, user: ROW })).toBe("Inès.T");
    expect(shopOrderPerson({ ...TYPED, user: { ...ROW, loyaltyBadge: "GOLD" } })).toEqual({
      firstName: "Inès",
      lastName: "Typée",
      phone: "+33711223344",
      loyaltyBadge: null,
    });
  });

  it("une commande de membre garde sa ligne, badge compris", () => {
    const user = { ...ROW, loyaltyBadge: "GOLD" as const };
    expect(shopOrderPerson({ ...MEMBER, user })).toBe(user);
    expect(orderClientName({ ...MEMBER, user })).toBe("Samir.B");
  });

  it("numéro client : aucun pour une commande invitée, même d'avant C1-INVITES", () => {
    expect(orderCustomerNumber({ placedAsGuest: true, customerNumber: 7 })).toBeNull();
    expect(orderCustomerNumber({ placedAsGuest: false, customerNumber: 12 })).toBe(12);
  });

  it("clé de client : la ligne pour un membre, l'identité saisie sous la ligne pour un invité", () => {
    expect(orderClientKey({ ...MEMBER, userId: "u1" })).toBe("u1");
    expect(orderClientKey({ ...LEGACY_GUEST, userId: "u1" })).toBe("u1");
    const typed = orderClientKey({ ...TYPED, userId: "u1" });
    expect(typed).not.toBe("u1");
    expect(orderClientKey({ ...TYPED, customerPhone: null, userId: "u1" })).toBe(typed);
    expect(
      orderClientKey({
        ...TYPED,
        customerFirstName: "Inès:Typée",
        customerLastName: "",
        userId: "u1",
      })
    ).not.toBe(
      orderClientKey({
        ...TYPED,
        customerFirstName: "Inès",
        customerLastName: "Typée:",
        userId: "u1",
      })
    );
  });

  it("splitOrderPerson et withOrderPersonName retirent les colonnes qui décident", () => {
    const user = { id: "u1", firstName: "Samir", lastName: "Benali", email: "compte@x.test" };
    const row = { id: "o1", ...TYPED, user };
    expect(splitOrderPerson(row)).toEqual({ order: { id: "o1", user }, person: TYPED });
    expect(withOrderPersonName(row)).toEqual({
      id: "o1",
      user: { id: "u1", firstName: "Inès", lastName: "Typée", email: "compte@x.test" },
    });
    expect(withOrderPersonName({ ...MEMBER, id: "o2", user })).toEqual({ id: "o2", user });
  });
});

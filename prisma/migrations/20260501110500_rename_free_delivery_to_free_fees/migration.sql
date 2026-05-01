-- Rename OfferType enum value FREE_DELIVERY -> FREE_FEES
-- Klik&Go is click & collect (no delivery), this offer waives the 0,99€ service fee
-- to the customer, so "free fees" is the accurate name.
ALTER TYPE "OfferType" RENAME VALUE 'FREE_DELIVERY' TO 'FREE_FEES';

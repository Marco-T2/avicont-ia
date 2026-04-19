# iva-purchase-book-domain Specification (Delta)

## Purpose

Describes the new backend capabilities added to the `iva-purchase-book-domain`: the `reactivatePurchase` method at the repository layer, the service orchestration method, and the corresponding API route. All three mirror the existing `reactivateSale` implementation and MUST follow the same patterns.

---

## ADDED Requirements

### REQ-B.1 — `reactivatePurchase` Service Method

`IvaBooksService` MUST expose a `reactivatePurchase(orgId: string, userId: string, id: string)` method that:
1. Delegates status flip to `repo.reactivatePurchase(orgId, id)`.
2. After a successful status flip, calls `maybeRegenerateJournal("purchase", purchaseId, orgId, userId)` to restore IVA and IT journal lines.
3. Returns the updated `IvaPurchaseBookDTO` with `status: "ACTIVE"`.
4. Throws `ConflictError` (propagated from the repository) if the entry is already ACTIVE.

#### Scenario: Service delegates to repo and triggers journal regeneration

- GIVEN `IvaBooksRepository.reactivatePurchase` is called and resolves a DTO with `status: "ACTIVE"`
- WHEN `IvaBooksService.reactivatePurchase(orgId, userId, id)` is invoked
- THEN `repo.reactivatePurchase` is called with `(orgId, id)`
- AND `maybeRegenerateJournal("purchase", purchaseId, orgId, userId)` is called once
- AND the method returns the DTO with `status: "ACTIVE"`

#### Scenario: Service propagates ConflictError when already ACTIVE

- GIVEN the `IvaPurchaseBook` entry has `status: "ACTIVE"`
- WHEN `IvaBooksService.reactivatePurchase` is called
- THEN a `ConflictError` is thrown with a message indicating the entry is already active
- AND `maybeRegenerateJournal` is NOT called

#### Scenario: Journal regeneration restores IVA and IT lines after reactivate

- GIVEN a purchase that originally had IVA and IT journal lines, whose `IvaPurchaseBook` was VOIDED
- WHEN `IvaBooksService.reactivatePurchase` completes successfully
- THEN the resulting journal entry contains IVA lines and IT lines
- AND the purchase record (amounts, lines) is unchanged

---

### REQ-B.2 — `reactivatePurchase` Repository Method

`IvaBooksRepository` MUST expose a `reactivatePurchase(orgId: string, id: string)` method that:
1. Looks up the `IvaPurchaseBook` row by `id` and `organizationId`.
2. Throws `NotFoundError` if not found.
3. Throws `ConflictError` if `status !== "VOIDED"` (guard against double-reactivate).
4. Updates `status` to `"ACTIVE"`. MUST NOT touch `estadoSIN` (orthogonal axis).
5. Returns the updated `IvaPurchaseBookDTO`.

#### Scenario: Successful reactivation of a VOIDED entry

- GIVEN an `IvaPurchaseBook` row exists with `status: "VOIDED"` for the given `orgId`
- WHEN `repo.reactivatePurchase(orgId, id)` is called
- THEN the row's `status` is updated to `"ACTIVE"`
- AND `estadoSIN` is unchanged
- AND the updated DTO is returned

#### Scenario: Throws NotFoundError for non-existent id

- GIVEN no `IvaPurchaseBook` row exists with the given `id` and `orgId`
- WHEN `repo.reactivatePurchase(orgId, id)` is called
- THEN a `NotFoundError` is thrown

#### Scenario: Throws ConflictError when status is already ACTIVE

- GIVEN an `IvaPurchaseBook` row exists with `status: "ACTIVE"`
- WHEN `repo.reactivatePurchase(orgId, id)` is called
- THEN a `ConflictError` is thrown with a message indicating the entry is already active
- AND the row is not modified

---

### REQ-B.3 — `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` Route

A new API route MUST be created at `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts` that:
1. Accepts `PATCH` requests.
2. Resolves `orgId` from `orgSlug` and `userId` from the Clerk session.
3. Calls `IvaBooksService.reactivatePurchase(orgId, userId, id)`.
4. Returns `200 OK` with the updated `IvaPurchaseBookDTO` on success.
5. Returns `404` when `NotFoundError` is thrown.
6. Returns `409` when `ConflictError` is thrown.
7. Mirrors the structure of the existing sales reactivate route at `app/api/organizations/[orgSlug]/iva-books/sales/[id]/reactivate/route.ts`.

#### Scenario: PATCH reactivate returns 200 with updated DTO

- GIVEN a valid `orgSlug`, authenticated user, and a `IvaPurchaseBook` id with status VOIDED
- WHEN `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` is called
- THEN the response is `200 OK`
- AND the body contains the `IvaPurchaseBookDTO` with `status: "ACTIVE"`

#### Scenario: PATCH reactivate returns 404 for unknown id

- GIVEN a valid `orgSlug`, authenticated user, and an id that does not exist
- WHEN `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` is called
- THEN the response is `404 Not Found`

#### Scenario: PATCH reactivate returns 409 when already ACTIVE

- GIVEN a valid `orgSlug`, authenticated user, and an `IvaPurchaseBook` id with status ACTIVE
- WHEN `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` is called
- THEN the response is `409 Conflict`

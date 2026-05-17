## Ticket Test Cases

### Notes
- These cases are based on the current open workspace code.
- The technician response flow is implemented in `frontend/technician/ticket-detail.js`.
- The admin ticket creation route is implemented in `backend/routes/tickets.routes.js` and `backend/services/ticket.service.js`.
- Current frontend admin UI (`frontend/admin/admin.js`) exposes ticket listing/filtering but does not include a dedicated create-ticket form in this workspace.

## Scenario 1: Technician Response Submission + Timeline Attachment Rendering

### Prerequisites
- Logged in as `technician` or `head`.
- Open `frontend/technician/ticket-detail.html?id=<ticketId>` for an existing ticket.
- Files available: `sample-image.png`, `sample-document.pdf`.

### Test Data
- Message: `Please review this attachment.`
- Image file: `sample-image.png`
- Document file: `sample-document.pdf`

### Steps and Expected Results

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open the ticket detail page and verify the ticket loads | The page displays ticket header fields: `#ticketTitle`, `#ticketDescription`, `#ticketStatus`, `#ticketPriority`, `#ticketCompany`, `#ticketRequestor` |
| 2 | Verify the timeline area exists | `#timeline` is present and renders current activity or an empty state |
| 3 | Enter `Please review this attachment.` into `#responseText` | The response text input contains the exact text |
| 4 | Choose `sample-image.png` in `#responseAttachment` | The file selector accepts the image and the input updates with a chosen file |
| 5 | Click `#sendResponseBtn` | Button becomes disabled and text changes to `Sending...`; request is sent to `POST /api/tickets/:id/responses` with multipart/form-data and field `attachment` |
| 6 | Confirm submission result | Success response appears in `#responseMessage` and the button returns to `Send Response` |
| 7 | Verify the new timeline entry appears in `#timeline` | A new timeline item with title `Response` appears and shows the message text |
| 8 | Verify the attachment label is rendered | The timeline item includes `This user has sent an attachment, along with the ticket` |
| 9 | Verify image preview or link | For image attachments, an `<img class="timeline-attachment">` is shown and `a.response-attachment` exists |
| 10 | Click the image attachment link | The link opens a backend-hosted URL containing `/uploads/ticket_responses/` and loads successfully |
| 11 | Submit a second response with `sample-document.pdf` attached | Request submits successfully; the form resets and timeline refreshes |
| 12 | Verify document attachment link appears | `a.attachment-file-link` is rendered with text `📎 Download attachment: sample-document.pdf` |
| 13 | Click the document link | The PDF opens/downloads successfully from the backend upload URL without redirecting to login |

### Validation Points
- The response route is `POST /api/tickets/:id/responses` and uses `attachmentUpload.single('attachment')`.
- Backend sets `attachment_url` to `/uploads/ticket_responses/<filename>`.
- Frontend `renderAttachment()` uses `buildAttachmentUrl()` to resolve `/uploads/...` against the backend API base and should not point at the frontend origin.
- Confirm `getAttachmentExtension()` detects `png` for image and `pdf` for document.

## Scenario 2: Admin Creating a Ticket on Behalf of a Client (API-Level)

### Prerequisites
- Logged in as `admin`.
- A client company exists in the system, e.g. `Test Company`.
- Admin can hit the backend API with a valid auth token.

### Test Data
- Title: `Client Email Access Request`
- Description: `Client cannot access email and needs urgent support.`
- Priority: `High`
- Company ID: `<companyId for Test Company>`
- Department ID: `<departmentId for IT Support>`

### Steps and Expected Results

| Step | Action | Expected Result |
|---|---|---|
| 1 | Authenticate as an admin user | Admin receives a valid auth token/cookie for API access |
| 2 | Send `POST /api/tickets` with JSON payload `{ title, description, priority, company_id, department_id }` | Response status is `201` and JSON contains `{ success: true, ticket }` |
| 3 | Verify created ticket fields in the response | Response includes a new `id` and `work_order_id` and `success: true` |
| 4 | Verify database ticket record exists | `tickets` row has `title`, `description`, `priority`, `company_id`, `department_id`, `requestor_id` = admin id, and `status` = `Open` |
| 5 | Verify log entry is created | `ticket_logs` contains `TICKET_CREATED` for the new ticket and admin user id |
| 6 | Verify client visibility by company | A `client` user with same `company_id` can hit `GET /api/tickets` and see the new ticket |
| 7 | Verify admin can view the ticket detail | `GET /api/tickets/:id` returns the ticket and includes `company_name`, `department_name`, `requestor_name` |

### Validation Points
- `backend/routes/tickets.routes.js` allows admin on `POST /api/tickets` and passes `requestor_id: req.user.id`.
- `backend/services/ticket.service.js` inserts the ticket using the supplied `company_id` and `department_id`.
- The ticket should be created with `status` = `Open` and a generated `work_order_id` like `WO-2026-XXXX`.
- Since no dedicated admin ticket creation form exists in the current frontend, validate this flow at the API level.

export const selectors = {
  date: '#ctl00_DefaultContent_InvoiceDateRadDatePicker_dateInput',
  dateState: '#ctl00_DefaultContent_InvoiceDateRadDatePicker_ClientState',
  invoice: '#ctl00_DefaultContent_InvoiceNumberTextBox',
  product: '#DefaultContent_ProductDropdownList',
  productWidget: '#DefaultContent_ProductDropdownList_chosen',
  qty: '#ctl00_DefaultContent_QtyClaimedRadNumericTextBox',
  add: '#DefaultContent_AddProductLinkButton',
  grid: '#ctl00_DefaultContent_ProductRadGrid_ctl00',
  upload: '#ctl00_DefaultContent_FileUploadRadAsyncUpload input[type=file]',
  uploadedRows: '#DefaultContent_UploadedFilesPanel table tbody tr',
  uploadSuccess: '.ruUploadSuccess',
  duplicatePopup: '#DefaultContent_DuplicateLineItemMessagePopupPanel',
  duplicateNo: '#DefaultContent_DuplicateLineItemMessagePopupPanel button',
  validationPopup: '#DefaultContent_ValidationPopupPanel'
} as const

export const requiredClaimSelectors = [
  selectors.date,
  selectors.invoice,
  selectors.product,
  selectors.productWidget,
  selectors.qty,
  selectors.add,
  selectors.grid,
  selectors.upload
] as const

export const neverClickSelectors = [
  '#DefaultContent_GoToStepFourLinkButton',
  '#DefaultContent_BackToStepTwoLinkButton',
  '#DefaultContent_YesLinkButton',
  '#DefaultContent_SubmitDuplicatesLinkButton',
  '#DefaultContent_PostClaimDuplicatesLinkButton'
] as const

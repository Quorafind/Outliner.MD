/* (From Stackoverflow)
 ** Returns the caret (cursor) position of the specified text field.
 ** Return value range is 0-oField.value.length.
 */
export namespace Cursor {
    export const getCaretPosition = function (oField) {
        // Initialize
        let iCaretPos = 0;

        // IE Support
        if (document.selection) {
            // Set focus on the element
            oField.focus();

            // To get cursor position, get empty selection range
            const oSel = document.selection.createRange();

            // Move selection start to 0 position
            oSel.moveStart('character', -oField.value.length);

            // The caret position is selection length
            iCaretPos = oSel.text.length;
        } else if (oField.selectionStart || oField.selectionStart == '0')
            // Firefox support
            iCaretPos = oField.selectionStart;

        // Return results
        return iCaretPos;
    };

    export const setCaretPosition = function (el, loc) {
        el.setSelectionRange(loc, loc);
    };

    // For contentEditable
    export const getCaretCharacterOffsetWithin = function (element) {
        let caretOffset = 0;
        const doc = element.ownerDocument || element.document;
        const win = doc.defaultView || doc.parentWindow;
        let sel;
        if (typeof win.getSelection != 'undefined') {
            sel = win.getSelection();
            if (sel.rangeCount > 0) {
                const range = win.getSelection().getRangeAt(0);
                const preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(element);
                preCaretRange.setEnd(range.endContainer, range.endOffset);
                caretOffset = preCaretRange.toString().length;
            }
        } else if ((sel = doc.selection) && sel.type != 'Control') {
            const textRange = sel.createRange();
            const preCaretTextRange = doc.body.createTextRange();
            preCaretTextRange.moveToElementText(element);
            preCaretTextRange.setEndPoint('EndToEnd', textRange);
            caretOffset = preCaretTextRange.text.length;
        }
        return caretOffset;
    };

    // For contentEditable
    export const setCursorLoc = function (contentEditableElement, caretLoc) {
        let range, selection;
        if (document.createRange) {
            //Firefox, Chrome, Opera, Safari, IE 9+
            range = document.createRange(); //Create a range (a range is a like the selection but invisible)
            //console.log(contentEditableElement, 'area');
            range.selectNodeContents(contentEditableElement); //Select the entire contents of the element with the range
            if (contentEditableElement.innerHTML.length > 0) {
                range.setStart(contentEditableElement.childNodes[0], caretLoc);
            }
            range.collapse(true); //collapse the range to the end point. false means collapse to end rather than the start
            selection = window.getSelection(); //get the selection object (allows you to change selection)
            selection.removeAllRanges(); //remove any selections already made
            selection.addRange(range); //make the range you have just created the visible selection
        } else if (document.selection) {
            //IE 8 and lower
            range = document.body.createTextRange(); //Create a range (a range is a like the selection but invisible)
            range.moveToElementText(contentEditableElement); //Select the entire contents of the element with the range
            range.collapse(false); //collapse the range to the end point. false means collapse to end rather than the start
            range.select(); //Select the range (make it the visible selection
        }
    };
}

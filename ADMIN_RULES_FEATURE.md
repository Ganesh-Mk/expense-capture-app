# Admin Rules & Limits Management - Feature Implementation

## Overview

Admins can now fully manage expense rules and grade-based spending limits through a dedicated dashboard page.

## Features Implemented

### 1. **Grade Selector**

- Select any grade from 1-10
- Quick toggle buttons for easy navigation
- Shows number of pending changes for selected grade

### 2. **Rules Table for Selected Grade**

- View all categories and their limits
- Columns:
  - Category name
  - Daily limit (₹)
  - Per-expense limit (₹)
  - Action buttons

### 3. **Edit Individual Rules**

- Click "Edit" on any rule
- Inline editing with input fields
- Validation:
  - Limits must be > 0
  - Per-expense limit cannot exceed daily limit
- Save or Cancel per rule
- Displays loading state while saving

### 4. **Bulk Save All Changes**

- Shows count of unsaved changes
- Save all changes at once
- "Save All Changes" button appears when there are edits
- Reset button to discard all changes

### 5. **Grade Reference Table**

- Shows all categories with daily limits for all 10 grades
- Visual grid display: 10 columns (one per grade)
- Hover to see exact amounts
- Quick at-a-glance comparison across grades

### 6. **Bulk Copy Rules**

- Copy all rules from one grade to another
- Example: "Copy Grade 5 rules to Grade 7"
- Useful for creating similar configurations
- Includes validation and error handling

### 7. **Success/Error Alerts**

- Real-time feedback on operations
- Auto-dismissing success messages (3 seconds)
- Clear error messages with validation details
- Sticky error display until dismissed

## Location

- **Page:** `/admin/rules`
- **Component:** [src/pages/admin/AdminRulesPage.tsx](src/pages/admin/AdminRulesPage.tsx)
- **Navigation:** Added "Rules & Limits" to admin sidebar with Sliders icon

## Technical Details

### Database Operations

- Reads from: `expense_rules`, `expense_categories`
- Writes to: `expense_rules` (UPDATE operations)
- RLS: Only admins can perform these operations
- Timestamps: `updated_at` automatically set to current time

### State Management

- Uses React hooks (useState, useEffect, useCallback)
- `editing` object tracks all changes before save
- Real-time validation of input values

### User Experience

- Debounced inputs prevent accidental multiple saves
- Loading spinners indicate background operations
- Clear visual feedback for all actions
- Sticky action buttons for easy access

## How to Use

### 1. **Edit a Single Rule**

1. Navigate to `/admin/rules`
2. Select a grade using buttons at the top
3. Click "Edit" on any category row
4. Update Daily Limit and Per-Expense Limit values
5. Click "Save" to update just that rule

### 2. **Edit Multiple Rules for One Grade**

1. Select a grade
2. Click "Edit" on multiple categories
3. Update all values
4. Click "Save All Changes (N)" button at bottom
5. All rules update simultaneously

### 3. **Copy Rules Between Grades**

1. Select destination grade
2. Scroll to "Bulk Operations"
3. Click "From G5" (or any source grade)
4. Confirm in success message

### 4. **View All Limits at Once**

1. Scroll to "Grade Reference" section
2. See all 10 grades and their limits by category
3. Useful for comparing and planning

## Validation Rules

| Check                     | Behavior                                 |
| ------------------------- | ---------------------------------------- |
| Daily Limit ≤ 0           | Error: "Limits must be > 0"              |
| Per-Expense > Daily       | Error: "Per-expense cannot exceed daily" |
| Same source & destination | Error: "Grades must be different"        |
| No source rules found     | Error: "No rules found for Grade X"      |

## Example Rules (Default)

### Grade 5, Food & Dining

- Daily Limit: ₹500
- Per-Expense Limit: ₹350

### Grade 10, Food & Dining

- Daily Limit: ₹1000
- Per-Expense Limit: ₹700

### Grade 5, Travel

- Daily Limit: ₹1500
- Per-Expense Limit: ₹1350

### Grade 10, Travel

- Daily Limit: ₹3500
- Per-Expense Limit: ₹3150

## UI Components Used

- Button (Edit, Save, Cancel, Copy)
- Card (organize sections)
- Input (numeric for limits)
- Label (form fields)
- Badge (change count indicator)
- Table (display rules)
- Skeleton (loading placeholders)
- Alert (success/error feedback)
- Separator (visual dividers)

## Integration

- ✅ Accessible via admin sidebar: "Rules & Limits" menu item
- ✅ Protected route: `/admin/rules` requires admin role
- ✅ RLS enforced at database level
- ✅ Seamless integration with existing admin dashboard

## Future Enhancements

1. **CSV Export:** Download current rules as CSV
2. **CSV Import:** Bulk upload new rules
3. **Version History:** Track changes over time
4. **Schedule Rules:** Apply rules on specific dates
5. **Alerts:** Notify on unusual spending patterns
6. **Rule Templates:** Preset configurations for common scenarios

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EXPENSE_RELATED_TYPE, type ExpenseRelatedType } from '@vacationist/types';

/**
 * Localised labels + picker options for every expense category. Shared by CreateExpenseSheet and
 * EditExpenseSheet, which each used to hardcode their own copy of this map — extending the category
 * list meant remembering to edit both. Built from EXPENSE_RELATED_TYPE, so a new category only needs
 * its `category.<type>` string in expenses.json (en + de).
 */
export function useExpenseCategoryLabels() {
  const { t } = useTranslation('expenses');
  return useMemo(() => {
    const labels = {} as Record<ExpenseRelatedType, string>;
    for (const type of EXPENSE_RELATED_TYPE) labels[type] = t(`category.${type}`);
    const options = EXPENSE_RELATED_TYPE.map((type) => ({ value: type, label: labels[type] }));
    return { labels, options };
  }, [t]);
}

-- KEYMAPS
--
-- See `:h vim.keymap.set()`, `:h mapping`, `:h keycodes`

-- Use <Esc> to exit terminal mode
vim.keymap.set('t', '<Esc>', '<C-\\><C-n>')

-- Map <A-j>, <A-k>, <A-h>, <A-l> to navigate between windows in any modes
vim.keymap.set({ 't', 'i' }, '<A-h>', '<C-\\><C-n><C-w>h')
vim.keymap.set({ 't', 'i' }, '<A-j>', '<C-\\><C-n><C-w>j')
vim.keymap.set({ 't', 'i' }, '<A-k>', '<C-\\><C-n><C-w>k')
vim.keymap.set({ 't', 'i' }, '<A-l>', '<C-\\><C-n><C-w>l')
vim.keymap.set({ 'n' }, '<A-h>', '<C-w>h')
--vim.keymap.set({ 'n' }, '<A-j>', '<C-w>j')
--vim.keymap.set({ 'n' }, '<A-k>', '<C-w>k')
vim.keymap.set({ 'n' }, '<A-l>', '<C-w>l')
-- Move line

vim.keymap.set('n', '<A-j>', ':m .+1<CR>==')
vim.keymap.set('n', '<A-k>', ':m .-2<CR>==')

vim.keymap.set('n' ,'<leader>e', vim.diagnostic.open_float, { desc = "Show diagnostic" })
vim.keymap.set('n' ,'[d', vim.diagnostic.goto_prev, { desc = "Prev diagnostic" })
vim.keymap.set('n' ,']d', vim.diagnostic.goto_prev, { desc = "Next diagnostic" })
vim.keymap.set('n' ,'<leader>q', vim.diagnostic.setloclist, { desc = "Diagnostic" })



vim.keymap.set('n', '<leader>et', function ()
  local new_value = not vim.diagnostic.config().virtual_text
  vim.diagnostic.config({ virtual_text = new_value})
  vim.notify("Virtual text: " .. (new_value and "on" or "off"))
  --if vim.diagnostic.is_enabled() then
  --  vim.diagnostic.enable(false)
  --  vim.notify("Diagnostic: off")
  --else
  --  vim.diagnostic.enable(true)
  --  vim.notify("Diagnostic: on")
  -- end
end, { desc = "Toggle diagnostic" })



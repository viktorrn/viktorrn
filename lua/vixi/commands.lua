-- REMAPS/commands


-- Add new files

vim.keymap.set('n', '<leader>nf', function()
  local dir = vim.fn.expand('%:p:h')
  local input = vim.fn.input('New file: ', dir .. '/', 'file')
  if input == '' then return end

  local parent = vim.fn.fnamemodify(input, ':h')
  vim.fn.mkdir(parent, 'p')

  vim.cmd('edit ' .. vim.fn.fnameescape(input))
end, {desc = "New file in current directory"})

-- Add new directory

vim.keymap.set('n', '<leader>nd', function ()
  local dir = vim.fn.expand('%:p:h')
  local input = vim.fn.input('New Directory: ', dir .. '/', 'file')
  if input == '' then return end
  vim.fn.mkdir(input, 'p')
  print('Created directory: ' .. input)
end, { desc = "New Directory" })

-- Remove folder

vim.keymap.set('n', '<leader> rm', function ()
  local path = vim.fn.expand('%:p')
  if path == '' then
    print('No file to delete')
    return
  end
  
  local confirm = vim.fn.input('Delete' .. path .. '? (y/n)')
  if confirm:lower() ~= 'y' then
    print(' Cancelled')
    return
  end

  local ok, err = pcall(vim.fn.delete, path)
  if ok then
    vim.cmd('bdelete!')
    print(' Delete : ' .. path)
  else
    print(' Error: ' .. tostring(err))
  end
end, { desc = "Delete current file" })

-- Acivate venv

vim.api.nvim_create_user_command("Venv", function (opts)
  local path =  opts.args ~= "" and opts.args or vim.fn.getcwd() .. "/.venv"
  path = vim.fn.fnamemodify(path, ":p"):gsub("[/\\]$", "")


  if vim.fn.isdirectory(path) == 0 then
    vim.notify("Venv not found: " .. path, vim.log.levels.ERROR)
    return
  end

  local is_win = vim.fn.has("win32") == 1
  local bin = is_win and (path .. "\\Scripts") or (path .. "/bin")
  local sep = is_win and ";" or ":"

  vim.env.VIRTUAL_ENV = path
  vim.env.PATH = bin .. sep .. vim.env.PATH
  vim.cmd("LspRestart")
  vim.notify("Actvated venv: " .. path )

end, { nargs = "?",  complete = "dir" })


-- AUTOCOMMANDS (EVENT HANDLERS)
--
-- See `:h lua-guide-autocommands`, `:h autocmd`, `:h nvim_create_autocmd()`

-- Highlight when yanking (copying) text.
-- Try it with `yap` in normal mode. See `:h vim.hl.on_yank()`
vim.api.nvim_create_autocmd('TextYankPost', {
  desc = 'Highlight when yanking (copying) text',
  callback = function()
    vim.hl.on_yank()
  end,
})


-- USER COMMANDS: DEFINE CUSTOM COMMANDS
--
-- See `:h nvim_create_user_command()` and `:h user-commands`

-- Create a command `:GitBlameLine` that print the git blame for the current line
vim.api.nvim_create_user_command('GitBlameLine', function()
  local line_number = vim.fn.line('.') -- Get the current line number. See `:h line()`
  local filename = vim.api.nvim_buf_get_name(0)
  print(vim.system({ 'git', 'blame', '-L', line_number .. ',+1', filename }):wait().stdout)
end, { desc = 'Print the git blame for the current line' })

-- Open config in explore mode
vim.api.nvim_create_user_command('Configure', function() 
  local config_dir = vim.fn.stdpath("config")
  vim.cmd.edit(config_dir)
end, {desc = 'Opens configuration menu in explore mode'})

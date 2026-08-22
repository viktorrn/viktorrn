return {
  "nvim-telescope/telescope.nvim",

--  tag = "0.1.5",

  dependencies = {
    "nvim-lua/plenary.nvim"
  },

  config = function()
    require('telescope').setup({
      defaults = {
        layout_strategy = "horizontal",
        layout_config = {
          preview_width = 0.6
        },
        file_ignore_patterns = { "%.git/", "node_modules", ".venv", "venv", "__pycache__" }
      }
    })

    local preview_utils = require("telescope.previewers.utils")
    preview_utils.ts_highlighter = function(bufnr, ft)
      local lang = vim.treesitter.language.get_lang(ft) or ft
      if not lang or lang == "" then
        return false
      end

      return pcall(vim.treesitter.start, bufnr, lang)
    end 

    local builtin = require('telescope.builtin')
    vim.keymap.set('n', '<leader>ff', builtin.find_files, {desc = "Find files"})
    vim.keymap.set('n', '<leader>fa', function() 
      builtin.find_files({
        hidden = true,
        no_ignore = true,
        file_ignore_patterns = {},
      })
    end, {desc = "Find all files"})
    --vim.keymap.set('n', '<C-p>', builtin.git_files, {})
    --vim.keymap.set('n', '<leader>pws', function()
      --    local word = vim.fn.expand("<cword>")
      --    builtin.grep_string({ search = word })
      --end)
      --vim.keymap.set('n', '<leader>pWs', function()
        --    local word = vim.fn.expand("<cWORD>")
        --    builtin.grep_string({ search = word })
        --end)
        vim.keymap.set('n', '<leader>conf', function()
          builtin.find_files {cwd = vim.fn.stdpath('config')}
        end, {desc = "Open configuration folder"})
        vim.keymap.set('n', '<leader>vh', builtin.help_tags, {})
        vim.keymap.set('n', '<leader>fg', builtin.live_grep, { desc = "Telescope live Grep (find in files) "})
      end
    }

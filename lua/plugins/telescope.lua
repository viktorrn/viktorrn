return {
    'nvim-telescope/telescope.nvim',
    tag = '0.1.8',  -- Specify the version or branch
    name = "telescope",
    lazy = true,  -- Load Telescope lazily
    cmd = "Telescope",  -- Load on :Telescope command
    keys = {  -- Trigger loading when any of these keymaps are used
        { "<leader>ff", desc = "Telescope find files" },
        { "<leader>fg", desc = "Telescope live grep" },
        { "<leader>fb", desc = "Telescope buffers" },
        { "<leader>fh", desc = "Telescope help tags" },
    },
    dependencies = {
        'nvim-lua/plenary.nvim',
        'nvim-telescope/telescope-live-grep-args.nvim'
    },
    config = function()
        -- Telescope setup with additional options
        require('telescope').setup{
            defaults = {
                layout_strategy = 'horizontal',
                layout_config = {
                    prompt_position = "top",
                    width = 0.9,
                },
                sorting_strategy = "ascending",
                mappings = {
                    i = {
                        ["<Esc>"] = require('telescope.actions').close,  -- Close with Esc
                    }
                }
            },
            extensions = {
                live_grep_args = {
                    -- Settings for live_grep_args can go here
                }
            }
        }

        -- Load key bindings for Telescope commands
        local builtin = require('telescope.builtin')
        vim.keymap.set('n', '<leader>ff', builtin.find_files, { desc = 'Telescope find files' })
        vim.keymap.set('n', '<leader>fg', require('telescope').extensions.live_grep_args.live_grep_args, { desc = 'Telescope live grep' })
        vim.keymap.set('n', '<leader>fb', builtin.buffers, { desc = 'Telescope buffers' })
        vim.keymap.set('n', '<leader>fh', builtin.help_tags, { desc = 'Telescope help tags' })

        -- Load the live_grep_args extension
        require('telescope').load_extension('live_grep_args')
    end
}


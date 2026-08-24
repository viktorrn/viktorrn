return {
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "williamboman/mason.nvim",
      "williamboman/mason-lspconfig.nvim",
      "hrsh7th/cmp-buffer"
    },
    config = function()
      require("mason").setup()
      local servers = { "lua_ls", "ts_ls", "pyright"}
      local lsp_conf = require("mason-lspconfig")
      lsp_conf.setup({
        ensure_installed = servers,
        automatic_installation = true,
      })

      vim.lsp.config('*', {
        capabilities =  require("cmp_nvim_lsp").default_capabilities(),
      })

      vim.keymap.set("n", "gd", vim.lsp.buf.definition,  { desc = "Goto Definition" })
      vim.keymap.set("n", "gD", vim.lsp.buf.declaration, { desc = "Goto Declaration" })
      vim.keymap.set("n", "gr", vim.lsp.buf.references,  { desc = "Goto References" })

      for _, server in ipairs(servers) do
        vim.lsp.enable(server)
      end
    end,
  },
  {
    "hrsh7th/nvim-cmp",
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
    },
    config = function() 
      local cmp = require("cmp")
      cmp.setup({
        mapping = cmp.mapping.preset.insert({
          ["<C-Space>"] = cmp.mapping.complete(),
          ["<CR>"] = cmp.mapping.confirm({ select = true }),
          ["<Tab>"] = cmp.mapping.select_next_item(),
          ["<S-Tab>"] = cmp.mapping.select_prev_item(),
        }),
        sources = {
          { name = "nvim_lsp" },
          { name = "buffer" },
        },
      })
  end,
},
}

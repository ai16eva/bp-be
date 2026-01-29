const express = require('express');
const router = express.Router({ strict: true });
const nftCtrl = require('../controllers/nftController');
const { adminAuth } = require('../middlewares/authWeb3');

router.get(
  '/:walletAddress',
  /*
    #swagger.auto = false
    #swagger.tags = ['NFT']
    #swagger.summary = 'Get NFTs for a wallet address (governance collection only)'
    #swagger.parameters['walletAddress'] = {
      in: 'path',
      required: true,
      type: 'string',
      description: 'Wallet address to fetch NFTs for'
    }
    #swagger.parameters['collection'] = {
      in: 'query',
      required: false,
      type: 'string',
      description: 'Collection address (optional, defaults to governance collection)'
    }
    #swagger.responses[200] = {
      description: 'Success',
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: {
                type: "integer",
                example: 1
              },
              data: {
                type: "object",
                properties: {
                  walletAddress: {
                    type: "string",
                    example: "ABC123..."
                  },
                  collectionAddress: {
                    type: "string",
                    example: "XYZ789..."
                  },
                  nfts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        mint: {
                          type: "string",
                          description: "NFT mint address"
                        },
                        tokenAccount: {
                          type: "string",
                          description: "Token account address of user"
                        },
                        metadataAccount: {
                          type: "string",
                          description: "Metadata account PDA address (required for onchain operations)"
                        },
                        amount: {
                          type: "string",
                          example: "1"
                        }
                      }
                    }
                  },
                  count: {
                    type: "integer",
                    example: 5
                  },
                  cached: {
                    type: "boolean",
                    example: true
                  }
                }
              },
              message: {
                type: "string",
                example: ""
              },
              error: {
                type: "null"
              }
            }
          }
        }
      }
    }
    #swagger.responses[400] = {
      description: "Bad Request",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: {
                type: "integer",
                example: 0
              },
              data: {
                type: "null"
              },
              message: {
                type: "string",
                example: "Invalid wallet address"
              },
              error: {
                type: "string",
                example: "WalletAddressInvalid"
              }
            }
          }
        }
      }
    }
  */
  nftCtrl.getUserNFTs
);

router.post(
  '/admin/reindex',
  adminAuth,
  /*
    #swagger.auto = false
    #swagger.tags = ['NFT']
    #swagger.summary = 'Reindex governance collection into DB'
    #swagger.parameters['body'] = {
      in: 'body',
      required: false,
      schema: {
        type: 'object',
        properties: {
          collection: { type: 'string', description: 'Optional collection mint address' }
        }
      }
    }
  */
  nftCtrl.reindex
);

module.exports = router;


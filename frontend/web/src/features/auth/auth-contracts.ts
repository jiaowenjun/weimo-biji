import * as z from 'zod/mini'

import type { TokenDto, UserProfile } from './auth-types'

export const tokenDtoSchema: z.ZodMiniType<TokenDto> = z.object({
  token: z.string(),
  token_type: z.string(),
})

export const userProfileSchema: z.ZodMiniType<UserProfile> = z.object({
  username: z.string(),
  nickname: z.string(),
  login_name: z.string(),
  has_login_password: z.boolean(),
})

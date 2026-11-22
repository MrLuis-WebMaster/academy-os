import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC = 'academy:public-route';
export const Public = () => SetMetadata(IS_PUBLIC, true);

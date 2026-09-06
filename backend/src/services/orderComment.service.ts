import { Prisma, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";

interface AuthenticatedUser {
  id: string;
  role: Role;
}

const COMMENT_INCLUDE = { user: true } satisfies Prisma.OrderCommentInclude;
type CommentRow = Prisma.OrderCommentGetPayload<{ include: typeof COMMENT_INCLUDE }>;

function format(comment: CommentRow) {
  return {
    id: comment.id,
    message: comment.message,
    createdAt: comment.createdAt,
    user: { id: comment.user.id, name: comment.user.name, role: comment.user.role },
  };
}

/**
 * Same visibility rule as quote.service.ts's getQuoteForUser - a Sales Rep
 * only ever sees their own quote's thread, every other internal role
 * (Manager/Finance/Admin) can see any quote's, matching how broadly they can
 * already view quotes elsewhere (Quotations, Approvals, Audit Trail).
 */
async function assertCanAccessQuote(quoteId: string, user: AuthenticatedUser) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { salesRepId: true } });
  if (!quote) {
    throw ApiError.notFound("Quote not found");
  }
  if (user.role === Role.SALES_REP && quote.salesRepId !== user.id) {
    throw ApiError.forbidden("You can only view discussion for your own quotes");
  }
}

export async function listComments(quoteId: string, user: AuthenticatedUser) {
  await assertCanAccessQuote(quoteId, user);
  const comments = await prisma.orderComment.findMany({
    where: { quoteId },
    include: COMMENT_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return comments.map(format);
}

export async function addComment(quoteId: string, user: AuthenticatedUser, message: string) {
  await assertCanAccessQuote(quoteId, user);
  await prisma.orderComment.create({
    data: { quoteId, userId: user.id, message },
  });
  return listComments(quoteId, user);
}

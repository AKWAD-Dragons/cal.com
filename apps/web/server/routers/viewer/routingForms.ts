import { Prisma } from "@prisma/client";
import { z } from "zod";

import { trpc } from "@lib/trpc";

import { createProtectedRouter } from "@server/createRouter";
import { TRPCError } from "@trpc/server";

type Field = {
  label: string;
  type: string;
  required: boolean;
};

export const app_RoutingForms = createProtectedRouter()
  .query("forms", {
    async resolve({ ctx: { user, prisma } }) {
      return await prisma.app_RoutingForms_Form.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    },
  })
  .query("form", {
    input: z.object({
      id: z.string(),
    }),
    async resolve({ ctx: { prisma }, input }) {
      const form = await prisma.app_RoutingForms_Form.findFirst({
        where: {
          id: input.id,
        },
      });

      return form;
    },
  })
  .mutation("form", {
    input: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      disabled: z.boolean().optional(),
      fields: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            type: z.string(),
            selectText: z.string().optional(),
            required: z.boolean().optional(),
          })
        )
        .optional(),
      routes: z
        .union([
          z.array(
            z.object({
              id: z.string(),
              queryValue: z.any(),
              isFallback: z.boolean().optional(),
              action: z.object({
                // TODO: Make it a union type of "customPageMessage" and ..
                type: z.string(),
                value: z.string(),
              }),
            })
          ),
          z.null(),
        ])
        .optional(),
    }),
    async resolve({ ctx: { user, prisma }, input }) {
      const { name, id, routes, description, disabled } = input;
      let { fields } = input;
      fields = fields || [];
      return await prisma.app_RoutingForms_Form.upsert({
        where: {
          id: id,
        },
        create: {
          user: {
            connect: {
              id: user.id,
            },
          },
          fields: fields,
          name: name,
          description,
          // Prisma doesn't allow setting null value directly for JSON. It recommends using JsonNull for that case.
          routes: routes === null ? Prisma.JsonNull : routes,
          id: id,
        },
        update: {
          disabled: disabled,
          fields: fields,
          name: name,
          description,
          routes: routes === null ? Prisma.JsonNull : routes,
        },
      });
    },
  })
  // TODO: Can't se use DELETE method on form?
  .mutation("deleteForm", {
    input: z.object({
      id: z.string(),
    }),
    async resolve({ ctx, input }) {
      return await ctx.prisma.app_RoutingForms_Form.delete({
        where: {
          id: input.id,
        },
      });
    },
  })
  .mutation("response", {
    input: z.object({
      formId: z.string(),
      formFillerId: z.string(),
      response: z.record(z.string()),
    }),
    async resolve({ ctx: { prisma }, input }) {
      try {
        return await prisma.app_RoutingForms_FormResponse.create({
          data: input,
        });
      } catch (e) {
        if (e.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
          });
        }
        throw e;
      }
    },
  });

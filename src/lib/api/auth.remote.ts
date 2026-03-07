import { form, command, getRequestEvent } from '$app/server';
import { redirect, invalid } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { signInSchema, signUpSchema } from '$lib/schemas/auth';
import { APIError } from 'better-auth/api';

export const signIn = form(
	signInSchema,
	async (data, issue) => {
		const event = getRequestEvent();
		try {
			await auth.api.signInEmail({
				body: { email: data.email, password: data._password },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				invalid(issue.email(error.message || 'Invalid email or password'));
			}
			throw error;
		}
		redirect(303, '/');
	}
);

export const signUp = form(
	signUpSchema,
	async (data, issue) => {
		const event = getRequestEvent();
		try {
			await auth.api.signUpEmail({
				body: { name: data.name, email: data.email, password: data._password },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				invalid(issue.email(error.message || 'Registration failed'));
			}
			throw error;
		}
		redirect(303, '/');
	}
);

export const signOut = command(async () => {
	const event = getRequestEvent();
	await auth.api.signOut({ headers: event.request.headers });
	redirect(303, '/auth/sign-in');
});

<script lang="ts">
	import { signUp } from '$lib/api/auth.remote';
	import { signUpSchema } from '$lib/schemas/auth';
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-sm">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Sign Up</h2>

		{#each signUp.fields.allIssues() as issue}
			<div class="alert text-sm alert-error">{issue.message}</div>
		{/each}

		<form {...signUp.preflight(signUpSchema)} class="flex flex-col gap-4">
			<label class="floating-label">
				<span>Name</span>
				<input
					{...signUp.fields.name.as('text')}
					class="input input-md w-full"
					placeholder="Name"
				/>
			</label>

			<label class="floating-label">
				<span>Email</span>
				<input
					{...signUp.fields.email.as('email')}
					class="input input-md w-full"
					placeholder="Email"
				/>
			</label>

			<label class="floating-label">
				<span>Password</span>
				<input
					{...signUp.fields._password.as('password')}
					class="input input-md w-full"
					placeholder="Password"
				/>
			</label>

			<button class="btn w-full btn-neutral" disabled={!!signUp.pending}>
				{signUp.pending ? 'Creating account...' : 'Sign Up'}
			</button>
		</form>

		<p class="text-center text-sm">
			Already have an account? <a href="/auth/sign-in" class="link">Sign in</a>
		</p>
	</div>
</div>

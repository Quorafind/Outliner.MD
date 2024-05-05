<script lang="ts">
	import SveltyPicker from 'svelty-picker';
	import { createEventDispatcher } from "svelte";
	import { moment } from "obsidian";

	export let date = moment().format('YYYY-MM-DD');
	export let type: "date" | "time" = 'date';
	export let value = date;
	let openProp = false;

	const dispatch = createEventDispatcher();

	console.log('type', type);

	function handleSelect(event: any) {
		if (!event.detail.value) return;
		dispatch('select', event.detail);
		value = event.detail.value;
	}

	function closeDatePicker() {
		openProp = false;
	}
</script>


<div class="details">
	<button class="summary" on:click={()=> {
		openProp = !openProp
	}}>{value}</button>
	{#if openProp}
		<div class="float-date-picker">
			<SveltyPicker pickerOnly mode={type} autocommit={true} initialDate={type === 'date' ? moment(date, 'YYYY-MM-DD').toDate() : moment(date, 'HH:mm:ss').toDate()} format={type === 'time'? 'hh:ii:ss' : 'yyyy-mm-dd'} positionResolver={()=>{
					}} on:dateChange={handleSelect} on:blur={closeDatePicker} on:cancel={closeDatePicker}>
				<svelte:fragment slot="action-row" let:i18n let:onToday
				>
					<div class="flex justify-end mt-2">
					<span>
						<button type="button" class="sdt-action-btn"
								on:click={closeDatePicker}>{i18n.cancelBtn}</button>
						<button type="button" class="sdt-action-btn" on:click={onToday}>{i18n.todayBtn}</button>
					</span>
					</div>
				</svelte:fragment>
			</SveltyPicker>
		</div>
	{/if}
</div>


<style>
	.details {
		display: inline-block;
		position: relative;
	}

	.summary {
		background-color: var(--background-secondary);
		display: inline-block;
		color: var(--text-muted);
		padding-left: var(--size-2-2);
		padding-right: var(--size-2-2);
		font-size: var(--font-ui-medium);
		font-weight: normal;
		border-radius: var(--radius-s);

		border: 1px solid var(--background-modifier-border);

		user-select: none;

		padding-top: 0;
		padding-bottom: 0;
		height: var(--size-4-6);
	}

	.details > .summary {
		list-style: none;
		cursor: pointer;
	}

	.details > .summary::-webkit-details-marker {
		display: none;
	}

	.float-date-picker {
		position: absolute;
		z-index: 1000;
		background-color: white;
		border: 1px solid #ccc;
		border-radius: 6px;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
	}

	:global(.theme-dark) {
		--sdt-bg-main: #585858;
		--sdt-shadow-color: #777;
		--sdt-color: #eee;
		--sdt-clock-color: var(--sdt-color);
		--sdt-clock-color-hover: var(--sdt-color);
		--sdt-clock-time-bg: transparent;
		--sdt-clock-time-bg-hover: transparent;
		--sdt-clock-disabled: #b22222;
		--sdt-clock-disabled-bg: var(--sdt-bg-main);
		--sdt-clock-selected-bg: var(--sdt-bg-selected);
		--sdt-header-color: #eee;
		--sdt-bg-selected: #e1ac4a;
		--sdt-table-disabled-date: #b22222;
		--sdt-table-disabled-date-bg: var(--sdt-bg-main);
		--sdt-table-data-bg-hover: #777;
		--sdt-table-selected-bg: var(--sdt-bg-selected);
		--sdt-header-btn-bg-hover: #777;
		--sdt-color-selected: #fff;
		--sdt-table-today-indicator: #ccc;
		--sdt-clock-bg: #999;
		/* custom buttons */
		--sdt-today-bg: #e4a124;
		--sdt-today-color: #fff;
		--sdt-clear-color: #666;
		--sdt-clear-bg: #ddd;
		--sdt-clear-hover-color: #fff;
		--sdt-clear-hover-bg: #dc3545;
	}

	:global(.theme-light) {
		--sdt-bg-main: #fff;
		--sdt-shadow-color: #ccc;
		--sdt-color: inherit;
		--sdt-clock-color: var(--sdt-color);
		--sdt-clock-color-hover: var(--sdt-color);
		--sdt-clock-time-bg: transparent;
		--sdt-clock-time-bg-hover: transparent;
		--sdt-clock-disabled: #b22222;
		--sdt-clock-disabled-bg: var(--sdt-bg-main);
		--sdt-clock-selected-bg: var(--sdt-bg-selected);
		--sdt-bg-selected: #286090;
		--sdt-table-disabled-date: #b22222;
		--sdt-table-disabled-date-bg: var(--sdt-bg-main);
		--sdt-table-data-bg-hover: #eee;
		--sdt-table-selected-bg: var(--sdt-bg-selected);
		--sdt-header-btn-bg-hover: #dfdfdf;
		--sdt-color-selected: #fff;
		--sdt-table-today-indicator: #ccc;
		--sdt-clock-bg: #eeeded;
		/* custom buttons */
		--sdt-today-bg: #1e486d;
		--sdt-today-color: #fff;
		--sdt-clear-color: #dc3545;
		--sdt-clear-bg: #fff;
		--sdt-clear-hover-color: #fff;
		--sdt-clear-hover-bg: #dc3545;
	}

	:global(.std-component-wrap) {
		display: flex !important;
	}

	:global(.sdt-calendar) {
		display: flex;
	}

	:global(.std-calendar-wrap) {
		display: flex;
		align-items: flex-end;
		flex-direction: column;
	}

	:global(.sdt-widget) {
		display: flex;
		flex-direction: column;
	}

	:global(.markdown-source-view.mod-cm6 .HyperMD-task-line[data-task="x"] .summary, .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task="X"] .summary) {
		text-decoration: var(--checklist-done-decoration);
		color: var(--checklist-done-color);
	}

</style>

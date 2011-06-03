<div id="stattr-js-event-create">
  <form id="stattr-js-event-create-form" action="javascript:">
    <h3>Create Event</h3>
    <p>Activity: <input id="stattr-js-event-create-activity" type="text" /> (e.g., ping-pong, darts, super smash)</p>
    <p>Officials: <input id="stattr-js-event-create-officials" type="text" /> (input Stattr username(s) separated by commas)</p>
    <p>Description: <input id="stattr-js-event-create-descr" type="text" /> (a few sentences describing the event and/or activity--shown on the event homepage)</p>
    <p>Unique ID: <input id="stattr-js-event-create-id" type="text" /> (this must be unique for this Stattr site, but if you have no preference we can create it for you)</p>
    <fieldset id="stattr-js-event-create-variables">
      <legend>Variables</legend>
      <p>This section requires you to create the variables you need for this event--then we can create the right database tables for it! As a guide, think of what statistics you will keep track of or record at the end of the activity you're trying to track. All variable names should be alphanumeric, since all other characters will just get stripped anyway.</p>
      <fieldset class="stattr-js-variable-repeater">
	<a href="javascript:" class="stattr-style-deleter stattr-js-variable-remove">X</a>
	<p>Identifier: <input class="stattr-js-variable-id" type="text" /> (e.g., score, accuracy, victory)</p>
	<p>Type:
	  <select class="stattr-js-variable-type">
	    <option value="bool">Boolean (true/false)</option>
	    <option value="int">Integer (whole numbers)</option>
	    <option value="double">Floating-point number (anything with a decimal point)</option>
	    <option value="varchar">Short string (a sentence or two)</option>
	    <option value="text">Longer string (a paragraph or more)</option>
	  </select>
	</p>
	<p class="stattr-js-char-validity">
	  Regex of disallowed characters: <input type="text" class="stattr-js-char-validation" /><br />WARNING: The above input field's contents will be evaluated in a JavaScript environment. A responsible admin will ONLY enter a valid regular expression, and nothing else. Don't put anything here that you don't fully understand!
	</p>
	<p class="stattr-js-val-validity">
	  Range of valid values: <br />
	  From
	  <input type="text" style="width: 100px;" class="stattr-js-val-validation-from" />
	  to
	  <input type="text" style="width: 100px;" class="stattr-js-val-validation-to" />.
	</p>
      </fieldset>
      <a href="javascript:" id="stattr-js-variable-add">Add another</a>
    </fieldset>
    <input type="submit" id="stattr-js-event-create-submit" />
  </form>
</div>

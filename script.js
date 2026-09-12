const form = document.getElementById("bookingForm");
const pickup = document.getElementById("pickupDate");
const dropoff = document.getElementById("dropoffDate");

if (pickup && dropoff) {
  const today = new Date().toISOString().split("T")[0];
  pickup.min = today;
  dropoff.min = today;

  pickup.addEventListener("change", () => {
    dropoff.min = pickup.value || today;
    if (dropoff.value && pickup.value && dropoff.value < pickup.value) {
      dropoff.value = pickup.value;
    }
  });
}

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const p = pickup ? pickup.value : "";
    const d = dropoff ? dropoff.value : "";

    if (!p || !d) {
      alert("Please select both pick-up and drop-off dates.");
      return;
    }

    if (d < p) {
      alert("Drop-off date cannot be before pick-up date.");
      return;
    }

    const carsSection = document.getElementById("cars");
    if (carsSection) {
      carsSection.scrollIntoView({behavior:"smooth", block:"start"});
    }
  });
}

const yearNode = document.getElementById("year");
if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

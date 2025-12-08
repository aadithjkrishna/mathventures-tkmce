let submittedAssignments = [false, false, false];

function submitAssignment(index) {
  const fileInput = document.getElementById(`file${index}`);
  const file = fileInput.files[0];

  if (!file) {
    alert("Please choose a file first!");
    return;
  }

  submittedAssignments[index - 1] = true;
  updateForestImage();
}

function updateForestImage() {
  const count = submittedAssignments.filter(Boolean).length;
  const forestImage = document.getElementById("forestImage");

  if (count === 0) {
    forestImage.src = "saa.png";
  } else if (count === 1) {
    forestImage.src = "laaa.png";
  } else if (count === 2) {
    forestImage.src = "daa.png";
  } else {
    forestImage.src = "images/land-stage3.png";
  }
}

<spline-viewer class="robot" url="https://prod.spline.design/JhPkmeyels7MOCBt/scene.splinecode"></spline-viewer>
</div>
<script type="module" src="https://unpkg.com/@splinetool/viewer@1.10.7/build/spline-viewer.js"></script>

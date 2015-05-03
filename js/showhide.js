/**
 * Created by ctclements on 5/3/15.
 */
function showhide()
{
    var div = document.getElementById("howto");
    if (div.style.display !== "none") {
        div.style.display = "none";
    }
    else {
        div.style.display = "block";
    }
}
